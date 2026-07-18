import { EventEmitter2 } from "@nestjs/event-emitter";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { EnrollmentService } from "../../src/modules/enrollment/enrollment.service";
import { EarningsService } from "../../src/modules/payments/earnings.service";
import { PaymentGatewayRegistry } from "../../src/modules/payments/payment-gateway.registry";
import { PaymentsService } from "../../src/modules/payments/payments.service";
import { PricingSnapshotService } from "../../src/modules/payments/pricing-snapshot.service";
import type { CachePort } from "../../src/shared/cache/cache.port";
import { PlatformSettingsService } from "../../src/shared/settings/platform-settings.service";
import { getTestPrisma } from "./support/db";
import { createCourse, createUser } from "./support/factories";
import { FakeQueuePort } from "./support/fakes/fake-queue";

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

/**
 * The creator's commercial ledger (§8.5). Its reason for existing: at e = 100 an
 * on-time finish writes NO instructor payout, so the cash ledger cannot tell a
 * sale from silence. These tests pin that the orders projection can.
 */
describe("EarningsService.ledger (integration)", () => {
	const prisma = getTestPrisma();
	const events = new EventEmitter2();
	const settings = new PlatformSettingsService(prisma, memoryCache());
	const snapshots = new PricingSnapshotService(prisma, settings);
	const gateways = new PaymentGatewayRegistry(settings);
	const enrollment = new EnrollmentService(prisma, events);
	const payments = new PaymentsService(
		prisma,
		snapshots,
		gateways,
		enrollment,
		events,
		new FakeQueuePort(),
	);
	const earnings = new EarningsService(prisma);

	let instructorId: string;

	beforeEach(async () => {
		const i = await createUser(prisma, { role: "instructor" });
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

	/** Buy `courseId` as a fresh learner and settle the payment. */
	async function buy(courseId: string) {
		const l = await createUser(prisma, { role: "learner" });
		const { orderId } = await payments.initCheckout(
			learner(l.id, l.email),
			"course",
			courseId,
		);
		await payments.handleWebhook(
			"paystack",
			webhookBody(orderId, 10_000),
			FAKE_SIG,
		);
		return { orderId, learnerId: l.id };
	}

	/** Resolve an order the way EarnBackService does, at a chosen tardiness. */
	async function resolveEarnBack(
		orderId: string,
		learnerId: string,
		opts: { daysLate: number; forfeited: number; instructorCut: number },
	) {
		await prisma.order.update({
			where: { id: orderId },
			data: { status: "earn_back_issued" },
		});
		await prisma.earnBackTransaction.create({
			data: {
				orderId,
				userId: learnerId,
				amountPaid: 100,
				daysLate: opts.daysLate,
				earnBackAmount: 95 - opts.forfeited,
				forfeitedAmount: opts.forfeited,
				forfeitedPlatformCut: opts.forfeited - opts.instructorCut,
				forfeitedInstructorCut: opts.instructorCut,
				currency: "NGN",
				status: opts.forfeited >= 95 ? "no_payout" : "processed",
			},
		});
	}

	it("shows an on-time e=100 sale that pays nothing — the case cash can't see", async () => {
		const course = await paidCourse({
			price: 100,
			earnBack: { pct: 100, days: 30 },
		});
		const { orderId, learnerId } = await buy(course.id);
		await resolveEarnBack(orderId, learnerId, {
			daysLate: 0,
			forfeited: 0,
			instructorCut: 0,
		});

		// The cash ledger is silent: no payout row was ever written.
		expect(
			await prisma.instructorPayout.count({ where: { instructorId } }),
		).toBe(0);
		expect((await earnings.summary(instructorId)).lifetimeProcessed).toBe(0);

		// The commercial ledger is not.
		const ledger = await earnings.ledger(instructorId);
		expect(ledger.summary.salesCount).toBe(1);
		expect(ledger.summary.grossMajor).toBe(100);
		expect(ledger.summary.earnedMajor).toBe(0);
		expect(ledger.summary.finishedOnTimeCount).toBe(1);
		expect(ledger.rows[0]).toMatchObject({
			outcome: "finished_on_time",
			earnBackPercentage: 100,
			totalEarned: 0,
			atStake: 0,
			daysLate: 0,
		});
	});

	it("reports the ceiling on an open escrow without counting it as earned", async () => {
		const course = await paidCourse({
			price: 100,
			earnBack: { pct: 100, days: 30 },
		});
		await buy(course.id);

		const ledger = await earnings.ledger(instructorId);
		expect(ledger.rows[0]).toMatchObject({
			outcome: "at_stake",
			atStake: 85.5,
		});
		expect(ledger.rows[0].deadline).toBeTruthy();
		expect(ledger.summary.atStakeMajor).toBe(85.5);
		// At stake is not earned. This separation is the whole point.
		expect(ledger.summary.earnedMajor).toBe(0);
	});

	it("credits a late finish and keeps the on-time count honest", async () => {
		const course = await paidCourse({
			price: 100,
			earnBack: { pct: 100, days: 30 },
		});
		const { orderId, learnerId } = await buy(course.id);
		// 10 days late ⇒ 20% of the 95 base forfeits = 19; creator's 90% = 17.1.
		await resolveEarnBack(orderId, learnerId, {
			daysLate: 10,
			forfeited: 19,
			instructorCut: 17.1,
		});

		const ledger = await earnings.ledger(instructorId);
		expect(ledger.rows[0]).toMatchObject({
			outcome: "finished_late",
			earnedFromEscrow: 17.1,
			totalEarned: 17.1,
			daysLate: 10,
		});
		expect(ledger.summary.earnedMajor).toBe(17.1);
		expect(ledger.summary.finishedOnTimeCount).toBe(0);
	});

	it("treats a non-earn-back sale as settled at checkout", async () => {
		const course = await paidCourse({ price: 100 });
		await buy(course.id);

		const ledger = await earnings.ledger(instructorId);
		expect(ledger.rows[0]).toMatchObject({
			outcome: "settled",
			earnBackPercentage: null,
			guaranteed: 85.5, // 90% of the post-fee 95
			totalEarned: 85.5,
			atStake: 0,
		});
	});

	it("never shows one creator another's sales", async () => {
		const mine = await paidCourse({ price: 100 });
		await buy(mine.id);

		const other = await createUser(prisma, { role: "instructor" });
		const theirs = await createCourse(prisma, {
			status: "published",
			createdBy: other.id,
		});
		await prisma.course.update({
			where: { id: theirs.id },
			data: { isFree: false, price: 100, currency: "NGN" },
		});
		await buy(theirs.id);

		expect((await earnings.ledger(instructorId)).summary.salesCount).toBe(1);
		expect((await earnings.ledger(other.id)).summary.salesCount).toBe(1);
	});

	it("ignores checkouts that never got paid", async () => {
		const course = await paidCourse({ price: 100 });
		const l = await createUser(prisma, { role: "learner" });
		// Init a checkout but never settle the webhook — no money arrived.
		await payments.initCheckout(learner(l.id, l.email), "course", course.id);

		const ledger = await earnings.ledger(instructorId);
		expect(ledger.summary.salesCount).toBe(0);
		expect(ledger.summary.grossMajor).toBe(0);
	});

	it("keeps historical earnings frozen when the creator edits the percentage", async () => {
		const course = await paidCourse({
			price: 100,
			earnBack: { pct: 50, days: 30 },
		});
		await buy(course.id);

		const before = await earnings.ledger(instructorId);
		expect(before.rows[0]).toMatchObject({
			earnBackPercentage: 50,
			guaranteed: 42.75, // 90% of N = 47.5
			atStake: 42.75, // 90% of B = 47.5
		});

		await prisma.course.update({
			where: { id: course.id },
			data: { earnBackPercentage: 100 },
		});

		// The snapshot rules (§4.11.2): that sale's terms cannot be restated.
		const after = await earnings.ledger(instructorId);
		expect(after.rows[0]).toMatchObject({
			earnBackPercentage: 50,
			guaranteed: 42.75,
			atStake: 42.75,
		});
	});
});
