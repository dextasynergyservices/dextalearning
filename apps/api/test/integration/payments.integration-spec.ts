import { HttpException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { EnrollmentService } from "../../src/modules/enrollment/enrollment.service";
import { AdminPayoutsService } from "../../src/modules/payments/admin-payouts.service";
import { EarnBackDeadlineService } from "../../src/modules/payments/earn-back-deadline.service";
import { PaymentGatewayRegistry } from "../../src/modules/payments/payment-gateway.registry";
import { PaymentsService } from "../../src/modules/payments/payments.service";
import { PricingSnapshotService } from "../../src/modules/payments/pricing-snapshot.service";
import type { CachePort } from "../../src/shared/cache/cache.port";
import { PaymentEvents } from "../../src/shared/events/payment-events";
import { PlatformSettingsService } from "../../src/shared/settings/platform-settings.service";
import { getTestPrisma } from "./support/db";
import { createCohort, createCourse, createUser } from "./support/factories";

function memoryCache(): CachePort {
	const store = new Map<string, unknown>();
	return {
		get: async <T>(k: string) => (store.has(k) ? (store.get(k) as T) : null),
		set: async (k, v) => {
			store.set(k, v);
		},
		del: async (k) => {
			store.delete(k);
		},
		incr: async () => 0,
	};
}

function learner(id: string, email: string): AuthenticatedUser {
	return { id, email, role: "learner" };
}

/** Fake gateway webhook body (matches FakeGatewayAdapter.parseWebhook). */
function webhookBody(reference: string, amountMinor: number, currency = "NGN") {
	return Buffer.from(
		JSON.stringify({
			event: "charge.success",
			reference,
			amountMinor,
			currency,
		}),
	);
}
const FAKE_SIG = "fake-gateway-secret";

describe("PaymentsService (integration)", () => {
	const prisma = getTestPrisma();
	const events = new EventEmitter2();
	const settings = new PlatformSettingsService(prisma, memoryCache());
	const snapshots = new PricingSnapshotService(prisma, settings);
	const gateways = new PaymentGatewayRegistry(settings);
	const enrollment = new EnrollmentService(prisma, events);
	const payoutQueue = { add: vi.fn() } as unknown as Queue;
	const service = new PaymentsService(
		prisma,
		snapshots,
		gateways,
		enrollment,
		events,
		payoutQueue,
	);

	let learnerId: string;
	let learnerEmail: string;
	let instructorId: string;
	let emitted: { event: string; payload: unknown }[] = [];
	events.onAny((e, p) => emitted.push({ event: String(e), payload: p }));

	beforeEach(async () => {
		emitted = [];
		(payoutQueue.add as ReturnType<typeof vi.fn>).mockClear();
		const l = await createUser(prisma, { role: "learner" });
		const i = await createUser(prisma, { role: "instructor" });
		learnerId = l.id;
		learnerEmail = l.email;
		instructorId = i.id;
	});

	async function paidCourse(opts: {
		price: number;
		earnBack?: { pct: number; days?: number };
	}) {
		const course = await createCourse(prisma, {
			status: "published",
			createdBy: instructorId,
		});
		return prisma.course.update({
			where: { id: course.id },
			data: {
				isFree: false,
				price: opts.price,
				currency: "NGN",
				isEarnBackEligible: !!opts.earnBack,
				earnBackPercentage: opts.earnBack?.pct ?? null,
				earnBackDeadlineDays: opts.earnBack?.days ?? null,
			},
		});
	}

	it("initCheckout freezes the snapshot + pools onto a pending order (earn-back OFF)", async () => {
		const course = await paidCourse({ price: 100 });
		const { orderId, authorizationUrl } = await service.initCheckout(
			learner(learnerId, learnerEmail),
			"course",
			course.id,
		);
		expect(authorizationUrl).toContain(orderId);
		const order = await prisma.order.findUnique({ where: { id: orderId } });
		expect(order?.status).toBe("pending");
		expect(Number(order?.amount)).toBe(100);
		// 5% default platform fee off the top → R = 95; earn-back OFF → N = R.
		expect(Number(order?.platformFee)).toBe(5);
		expect(Number(order?.guaranteedRevenue)).toBe(95);
		expect(Number(order?.earnBackBase)).toBe(0);
		expect(Number(order?.instructorAmount)).toBe(85.5); // 90% of 95
		expect(Number(order?.platformAmount)).toBe(14.5); // fee 5 + 10% of 95
		expect(order?.instructorId).toBe(instructorId);
		expect(order?.isPlatformOwned).toBe(false);
	});

	it("settles on webhook: order paid, instructor payout queued, learner enrolled (§2, §14.2)", async () => {
		const course = await paidCourse({ price: 100 });
		const { orderId } = await service.initCheckout(
			learner(learnerId, learnerEmail),
			"course",
			course.id,
		);

		const res = await service.handleWebhook(
			"paystack",
			webhookBody(orderId, 10_000),
			FAKE_SIG,
		);
		expect(res).toEqual({ handled: true });

		const order = await prisma.order.findUnique({ where: { id: orderId } });
		expect(order?.status).toBe("paid");
		expect(order?.paidAt).not.toBeNull();
		// Earn-back off → no deadline.
		expect(order?.earnBackDeadline).toBeNull();

		const payout = await prisma.instructorPayout.findFirst({
			where: { orderId },
		});
		expect(payout?.status).toBe("pending");
		expect(Number(payout?.amount)).toBe(85.5); // 90% of the post-fee ₦95
		expect(payoutQueue.add).toHaveBeenCalledTimes(1);
		// BullMQ rejects a custom job id containing ":" — a real gateway drive
		// caught this where the fake queue can't. Lock the separator in.
		const addOpts = (payoutQueue.add as ReturnType<typeof vi.fn>).mock
			.calls[0][2] as { jobId: string };
		expect(addOpts.jobId).not.toContain(":");
		expect(addOpts.jobId).toMatch(/^payout-/);

		expect(await enrollment.isEnrolled(learnerId, "course", course.id)).toBe(
			true,
		);
		expect(
			emitted.some((e) => e.event === PaymentEvents.PaymentConfirmed),
		).toBe(true);
	});

	it("verify-on-callback settles the order without a webhook (§14)", async () => {
		const course = await paidCourse({ price: 100 });
		const { orderId } = await service.initCheckout(
			learner(learnerId, learnerEmail),
			"course",
			course.id,
		);
		// No webhook — the callback verifies directly with the (Fake) gateway.
		const res = await service.verifyAndSettle(learnerId, orderId);
		expect(res.status).toBe("paid");
		expect(res.entityId).toBe(course.id);

		const order = await prisma.order.findUnique({ where: { id: orderId } });
		expect(order?.status).toBe("paid");
		expect(await enrollment.isEnrolled(learnerId, "course", course.id)).toBe(
			true,
		);
		// Idempotent — verifying again is a no-op that still reports paid.
		expect((await service.verifyAndSettle(learnerId, orderId)).status).toBe(
			"paid",
		);
	});

	it("sets the earn-back deadline from the frozen window when eligible (§4.11.2)", async () => {
		const course = await paidCourse({
			price: 100,
			earnBack: { pct: 50, days: 30 },
		});
		const { orderId } = await service.initCheckout(
			learner(learnerId, learnerEmail),
			"course",
			course.id,
		);
		const order0 = await prisma.order.findUnique({ where: { id: orderId } });
		// 5% fee off ₦100 → R = 95; 50% earn-back → base 47.5, N 47.5.
		expect(Number(order0?.platformFee)).toBe(5);
		expect(Number(order0?.earnBackBase)).toBe(47.5);
		expect(Number(order0?.guaranteedRevenue)).toBe(47.5);
		expect(Number(order0?.instructorAmount)).toBe(42.75); // 90% of 47.5

		await service.handleWebhook(
			"paystack",
			webhookBody(orderId, 10_000),
			FAKE_SIG,
		);
		const order = await prisma.order.findUnique({ where: { id: orderId } });
		expect(order?.earnBackDeadline).not.toBeNull();
		const days = Math.round(
			((order?.earnBackDeadline as Date).getTime() -
				(order?.paidAt as Date).getTime()) /
				(24 * 60 * 60 * 1000),
		);
		expect(days).toBe(30);
		// The creator fixed it, so the learner has nothing to decide.
		expect(order?.earnBackDeadlineSource).toBe("creator");
	});

	// ── The learner's personal deadline (§4.11.1) ───────────────────────────
	describe("learner-set Earn-Back deadline", () => {
		const deadlines = new EarnBackDeadlineService(prisma);

		/** Buy + settle a course whose creator left the window open. */
		async function settledOpenWindowOrder() {
			const course = await paidCourse({ price: 100, earnBack: { pct: 50 } });
			const { orderId } = await service.initCheckout(
				learner(learnerId, learnerEmail),
				"course",
				course.id,
			);
			await service.handleWebhook(
				"paystack",
				webhookBody(orderId, 10_000),
				FAKE_SIG,
			);
			return { course, orderId };
		}

		it("marks the order provisional and still stamps a deadline — escrow is never stranded", async () => {
			const { orderId } = await settledOpenWindowOrder();
			const order = await prisma.order.findUnique({ where: { id: orderId } });

			expect(order?.earnBackDeadlineSource).toBe("provisional");
			// Falls back to the platform max (60) so the window always resolves,
			// even if the learner never answers.
			expect(order?.earnBackDeadlineDays).toBe(60);
			expect(order?.earnBackDeadline).not.toBeNull();
		});

		it("tells the learner they still owe a choice", async () => {
			const { course } = await settledOpenWindowOrder();
			const status = await service.earnBackStatus(
				learnerId,
				"course",
				course.id,
			);
			expect(status?.canSetDeadline).toBe(true);
			expect(status?.deadlineSource).toBe("provisional");
			expect(status?.maxDays).toBe(60);
		});

		it("commits the learner, measuring the window from PAYMENT not from now", async () => {
			const { course, orderId } = await settledOpenWindowOrder();
			const result = await deadlines.setDeadline(
				learnerId,
				"course",
				course.id,
				14,
			);

			const order = await prisma.order.findUnique({ where: { id: orderId } });
			expect(order?.earnBackDeadlineSource).toBe("learner");
			expect(order?.earnBackDeadlineDays).toBe(14);
			expect(order?.earnBackDeadlineSetAt).not.toBeNull();
			const days = Math.round(
				((order?.earnBackDeadline as Date).getTime() -
					(order?.paidAt as Date).getTime()) /
					(24 * 60 * 60 * 1000),
			);
			expect(days).toBe(14);
			expect(result.days).toBe(14);
		});

		it("refuses a second commit — the lock is what makes it a commitment", async () => {
			const { course } = await settledOpenWindowOrder();
			await deadlines.setDeadline(learnerId, "course", course.id, 14);

			await expect(
				deadlines.setDeadline(learnerId, "course", course.id, 60),
			).rejects.toMatchObject({
				response: { details: { reason: "already_set" } },
			});
		});

		it("refuses a promise to finish later than the frozen window", async () => {
			const { course } = await settledOpenWindowOrder();
			await expect(
				deadlines.setDeadline(learnerId, "course", course.id, 61),
			).rejects.toMatchObject({
				response: { details: { reason: "out_of_range", maxDays: 60 } },
			});
		});

		it("refuses when the creator fixed the window", async () => {
			const course = await paidCourse({
				price: 100,
				earnBack: { pct: 50, days: 30 },
			});
			const { orderId } = await service.initCheckout(
				learner(learnerId, learnerEmail),
				"course",
				course.id,
			);
			await service.handleWebhook(
				"paystack",
				webhookBody(orderId, 10_000),
				FAKE_SIG,
			);

			await expect(
				deadlines.setDeadline(learnerId, "course", course.id, 10),
			).rejects.toMatchObject({
				response: { details: { reason: "fixed_by_creator" } },
			});
			const status = await service.earnBackStatus(
				learnerId,
				"course",
				course.id,
			);
			expect(status?.canSetDeadline).toBe(false);
		});

		// ── Cohorts are Admin-set, never learner-set ─────────────────────────
		async function paidCohort(days?: number) {
			const cohort = await createCohort(prisma, { status: "open" });
			return prisma.cohort.update({
				where: { id: cohort.id },
				data: {
					isFree: false,
					price: 100,
					currency: "NGN",
					isEarnBackEligible: true,
					earnBackPercentage: 50,
					earnBackDeadlineDays: days ?? null,
				},
			});
		}

		async function settleCohort(cohortId: string) {
			const { orderId } = await service.initCheckout(
				learner(learnerId, learnerEmail),
				"cohort",
				cohortId,
			);
			await service.handleWebhook(
				"paystack",
				webhookBody(orderId, 10_000),
				FAKE_SIG,
			);
			return orderId;
		}

		it("uses the Admin's cohort window and never asks the learner", async () => {
			const cohort = await paidCohort(21);
			const orderId = await settleCohort(cohort.id);

			const order = await prisma.order.findUnique({ where: { id: orderId } });
			expect(order?.earnBackDeadlineSource).toBe("creator");
			expect(order?.earnBackDeadlineDays).toBe(21);

			const status = await service.earnBackStatus(
				learnerId,
				"cohort",
				cohort.id,
			);
			expect(status?.canSetDeadline).toBe(false);
		});

		it("falls back to the platform max — never to the learner — when Admin leaves it blank", async () => {
			const cohort = await paidCohort();
			const orderId = await settleCohort(cohort.id);

			const order = await prisma.order.findUnique({ where: { id: orderId } });
			// A cohort is a scheduled programme: blank means "platform max", not
			// "provisional/learner decides" as it would on a course or path.
			expect(order?.earnBackDeadlineSource).toBe("creator");
			expect(order?.earnBackDeadlineDays).toBe(60);
		});

		it("refuses a learner trying to set a cohort deadline directly", async () => {
			const cohort = await paidCohort();
			await settleCohort(cohort.id);

			await expect(
				deadlines.setDeadline(learnerId, "cohort", cohort.id, 10),
			).rejects.toMatchObject({
				response: { details: { reason: "fixed_by_creator" } },
			});
		});

		it("refuses before the payment settles — there's no clock to start yet", async () => {
			const course = await paidCourse({ price: 100, earnBack: { pct: 50 } });
			await service.initCheckout(
				learner(learnerId, learnerEmail),
				"course",
				course.id,
			);
			// Order exists but is still `pending`.
			await expect(
				deadlines.setDeadline(learnerId, "course", course.id, 10),
			).rejects.toThrow();
		});
	});

	// ── Editing the catalogue never reaches an existing order (§4.11.2) ──────
	describe("order-time snapshot is immutable", () => {
		it("a creator changing the Earn-Back % only affects LATER buyers", async () => {
			const course = await paidCourse({
				price: 100,
				earnBack: { pct: 50, days: 30 },
			});

			// Buyer #1 purchases at 50%.
			const first = await service.initCheckout(
				learner(learnerId, learnerEmail),
				"course",
				course.id,
			);
			await service.handleWebhook(
				"paystack",
				webhookBody(first.orderId, 10_000),
				FAKE_SIG,
			);
			const before = await prisma.order.findUnique({
				where: { id: first.orderId },
			});
			expect(before?.earnBackPercentage).toBe(50);
			expect(Number(before?.earnBackBase)).toBe(47.5); // 50% of the post-fee 95
			expect(Number(before?.instructorAmount)).toBe(42.75);

			// The creator now edits the course: 50% → 100%, and 30 → 14 days.
			await prisma.course.update({
				where: { id: course.id },
				data: { earnBackPercentage: 100, earnBackDeadlineDays: 14 },
			});

			// Buyer #1's settled order is untouched — same %, same base, same
			// payout, same deadline. Their terms are the ones they bought under.
			const after = await prisma.order.findUnique({
				where: { id: first.orderId },
			});
			expect(after?.earnBackPercentage).toBe(50);
			expect(Number(after?.earnBackBase)).toBe(47.5);
			expect(Number(after?.instructorAmount)).toBe(42.75);
			expect(after?.earnBackDeadlineDays).toBe(30);
			expect(after?.earnBackDeadline).toEqual(before?.earnBackDeadline);

			// Buyer #2 buys after the edit and gets the NEW terms.
			const l2 = await createUser(prisma, { role: "learner" });
			const second = await service.initCheckout(
				learner(l2.id, l2.email),
				"course",
				course.id,
			);
			const secondOrder = await prisma.order.findUnique({
				where: { id: second.orderId },
			});
			expect(secondOrder?.earnBackPercentage).toBe(100);
			expect(Number(secondOrder?.earnBackBase)).toBe(95); // 100% of post-fee 95
			expect(Number(secondOrder?.instructorAmount)).toBe(0); // N = 0 at e=100
			expect(secondOrder?.earnBackDeadlineDays).toBe(14);
		});

		it("a price change doesn't re-price an existing order", async () => {
			const course = await paidCourse({ price: 100 });
			const { orderId } = await service.initCheckout(
				learner(learnerId, learnerEmail),
				"course",
				course.id,
			);
			await service.handleWebhook(
				"paystack",
				webhookBody(orderId, 10_000),
				FAKE_SIG,
			);

			await prisma.course.update({
				where: { id: course.id },
				data: { price: 500 },
			});

			const order = await prisma.order.findUnique({ where: { id: orderId } });
			expect(Number(order?.amount)).toBe(100);
			expect(Number(order?.instructorAmount)).toBe(85.5);
		});
	});

	it("is idempotent — a replayed webhook doesn't double-pay or double-enrol", async () => {
		const course = await paidCourse({ price: 100 });
		const { orderId } = await service.initCheckout(
			learner(learnerId, learnerEmail),
			"course",
			course.id,
		);
		await service.handleWebhook(
			"paystack",
			webhookBody(orderId, 10_000),
			FAKE_SIG,
		);
		await service.handleWebhook(
			"paystack",
			webhookBody(orderId, 10_000),
			FAKE_SIG,
		);

		expect(await prisma.instructorPayout.count({ where: { orderId } })).toBe(1);
		expect(payoutQueue.add).toHaveBeenCalledTimes(1);
	});

	it("rejects an invalid webhook signature", async () => {
		await expect(
			service.handleWebhook("paystack", webhookBody("x", 1), "wrong-sig"),
		).rejects.toThrow(HttpException);
	});

	it("cohort revenue is platform-owned — no instructor payout row", async () => {
		const cohort = await createCohort(prisma, { status: "open" });
		await prisma.cohort.update({
			where: { id: cohort.id },
			data: { isFree: false, price: 100, currency: "NGN" },
		});
		const { orderId } = await service.initCheckout(
			learner(learnerId, learnerEmail),
			"cohort",
			cohort.id,
		);
		const order = await prisma.order.findUnique({ where: { id: orderId } });
		expect(order?.isPlatformOwned).toBe(true);
		expect(Number(order?.platformAmount)).toBe(100);

		await service.handleWebhook(
			"paystack",
			webhookBody(orderId, 10_000),
			FAKE_SIG,
		);
		expect(await prisma.instructorPayout.count({ where: { orderId } })).toBe(0);
		expect(payoutQueue.add).not.toHaveBeenCalled();
	});

	it("free direct-enrol still works; paid content is gated behind checkout (§14)", async () => {
		const paid = await paidCourse({ price: 100 });
		await expect(
			enrollment.enroll(learner(learnerId, learnerEmail), "course", paid.id),
		).rejects.toThrow(HttpException);

		const free = await createCourse(prisma, { status: "published" });
		await expect(
			enrollment.enroll(learner(learnerId, learnerEmail), "course", free.id),
		).resolves.toEqual({ enrolled: true });
	});

	it("blocks a duplicate checkout when already enrolled", async () => {
		const course = await paidCourse({ price: 100 });
		const { orderId } = await service.initCheckout(
			learner(learnerId, learnerEmail),
			"course",
			course.id,
		);
		await service.handleWebhook(
			"paystack",
			webhookBody(orderId, 10_000),
			FAKE_SIG,
		);
		await expect(
			service.initCheckout(
				learner(learnerId, learnerEmail),
				"course",
				course.id,
			),
		).rejects.toThrow();
	});

	/**
	 * The on-time, e=100 case: the learner forfeits nothing, so the instructor
	 * earns nothing and NO payout row exists — the refund is the only artefact.
	 * Admin oversight has to read `earn_back_transactions` to see it at all.
	 */
	describe("Earn-Back refund visibility (§4.11.5, §14.3)", () => {
		const earnBackQueue = { add: vi.fn() } as unknown as Queue;
		const adminPayouts = new AdminPayoutsService(
			prisma,
			payoutQueue,
			earnBackQueue,
		);

		async function refundedOrder() {
			const course = await paidCourse({
				price: 100,
				earnBack: { pct: 100, days: 30 },
			});
			const { orderId } = await service.initCheckout(
				learner(learnerId, learnerEmail),
				"course",
				course.id,
			);
			await service.handleWebhook(
				"paystack",
				webhookBody(orderId, 10_000),
				FAKE_SIG,
			);
			// Resolve it the way EarnBackService does on an on-time completion.
			await prisma.order.update({
				where: { id: orderId },
				data: { status: "earn_back_issued" },
			});
			await prisma.earnBackTransaction.create({
				data: {
					orderId,
					userId: learnerId,
					amountPaid: 100,
					daysLate: 0,
					earnBackAmount: 95,
					forfeitedAmount: 0,
					forfeitedPlatformCut: 0,
					forfeitedInstructorCut: 0,
					currency: "NGN",
					status: "pending",
				},
			});
			return { courseId: course.id, orderId };
		}

		it("an on-time full Earn-Back produces a refund and no instructor payout", async () => {
			const { courseId } = await refundedOrder();

			const payouts = await prisma.instructorPayout.findMany({
				where: { instructorId },
			});
			expect(payouts).toHaveLength(0); // nothing forfeited ⇒ nothing to pay

			const refunds = await adminPayouts.recentRefunds();
			const row = refunds.find((r) => r.learnerId === learnerId);
			expect(row).toMatchObject({
				amount: 95,
				currency: "NGN",
				status: "pending",
				daysLate: 0,
			});
			expect(row?.entityTitle).toBeTruthy();
			expect(courseId).toBeTruthy();
		});

		it("surfaces the in-flight refund to the learner as pending, not as nothing", async () => {
			const { courseId } = await refundedOrder();

			const status = await service.earnBackStatus(
				learnerId,
				"course",
				courseId,
			);
			expect(status).toMatchObject({
				phase: "resolved",
				outcome: "pending",
				refundAmount: 95,
				refundedAt: null,
			});
		});

		it("reports the refund as processed once the gateway acknowledges it", async () => {
			const { courseId, orderId } = await refundedOrder();
			const processedAt = new Date();
			await prisma.earnBackTransaction.updateMany({
				where: { orderId },
				data: { status: "processed", processedAt, provider: "paystack" },
			});

			const status = await service.earnBackStatus(
				learnerId,
				"course",
				courseId,
			);
			expect(status?.outcome).toBe("processed");
			expect(status?.refundedAt).toBe(processedAt.toISOString());

			const refunds = await adminPayouts.recentRefunds();
			expect(refunds.find((r) => r.learnerId === learnerId)?.status).toBe(
				"processed",
			);
		});
	});
});
