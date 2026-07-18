import { EventEmitter2 } from "@nestjs/event-emitter";
import { beforeEach, describe, expect, it } from "vitest";
import { EarnBackService } from "../../src/modules/payments/earn-back.service";
import { PaymentEvents } from "../../src/shared/events/payment-events";
import {
	QUEUE_EARN_BACK,
	QUEUE_INSTRUCTOR_PAYOUT,
} from "../../src/shared/queue/queue.constants";
import { getTestPrisma } from "./support/db";
import { createCourse, createUser } from "./support/factories";
import { FakeQueuePort } from "./support/fakes/fake-queue";

const DAY = 24 * 60 * 60 * 1000;

describe("EarnBackService (integration)", () => {
	const prisma = getTestPrisma();
	const events = new EventEmitter2();
	const queue = new FakeQueuePort();
	const service = new EarnBackService(prisma, events, queue);
	const earnBackJobs = () =>
		queue.enqueued.filter((e) => e.queue === QUEUE_EARN_BACK);
	const payoutJobs = () =>
		queue.enqueued.filter((e) => e.queue === QUEUE_INSTRUCTOR_PAYOUT);

	let learnerId: string;
	let instructorId: string;
	let courseId: string;
	let emitted: string[] = [];
	events.onAny((e) => emitted.push(String(e)));

	beforeEach(async () => {
		emitted = [];
		queue.enqueued.length = 0;
		const l = await createUser(prisma, { role: "learner" });
		const i = await createUser(prisma, { role: "instructor" });
		const c = await createCourse(prisma, { createdBy: i.id });
		learnerId = l.id;
		instructorId = i.id;
		courseId = c.id;
	});

	/** A settled, earn-back-eligible order with base = 100 (of price 100). */
	function paidOrder(opts: { deadline: Date; platformOwned?: boolean }) {
		return prisma.order.create({
			data: {
				userId: learnerId,
				entityType: "course",
				entityId: courseId,
				entityTitle: "Paid Course",
				amount: 100,
				currency: "NGN",
				status: "paid",
				provider: "paystack",
				providerRef: "ref_123",
				isEarnBackEligible: true,
				earnBackPercentage: 100,
				revenueSplitPct: 90,
				earnBackBase: 100,
				guaranteedRevenue: 0,
				isPlatformOwned: opts.platformOwned ?? false,
				instructorId: opts.platformOwned ? null : instructorId,
				earnBackDeadline: opts.deadline,
			},
			select: { id: true, earnBackDeadline: true },
		});
	}

	it("on-time completion → full refund, no forfeiture, refund queued", async () => {
		const deadline = new Date(Date.now() + 10 * DAY);
		await paidOrder({ deadline });

		await service.resolveForCompletion(
			learnerId,
			"course",
			courseId,
			new Date(),
		);

		const txn = await prisma.earnBackTransaction.findFirst({
			where: { userId: learnerId },
		});
		expect(Number(txn?.earnBackAmount)).toBe(100);
		expect(Number(txn?.forfeitedAmount)).toBe(0);
		expect(txn?.status).toBe("pending");
		expect(earnBackJobs()).toHaveLength(1);
		expect(payoutJobs()).toHaveLength(0);

		const order = await prisma.order.findFirst({
			where: { userId: learnerId },
		});
		expect(order?.status).toBe("earn_back_issued");
	});

	it("10 days late → 20% forfeited (90/10 to instructor), 80% refunded", async () => {
		const deadline = new Date(Date.now() - 10 * DAY);
		await paidOrder({ deadline });

		await service.resolveForCompletion(
			learnerId,
			"course",
			courseId,
			new Date(),
		);

		const txn = await prisma.earnBackTransaction.findFirst({
			where: { userId: learnerId },
		});
		expect(txn?.daysLate).toBe(10);
		expect(Number(txn?.earnBackAmount)).toBe(80);
		expect(Number(txn?.forfeitedAmount)).toBe(20);
		expect(Number(txn?.forfeitedInstructorCut)).toBe(18);
		expect(earnBackJobs()).toHaveLength(1);
		expect(payoutJobs()).toHaveLength(1);

		const payout = await prisma.instructorPayout.findFirst({
			where: { instructorId },
		});
		expect(Number(payout?.amount)).toBe(18);
	});

	it("expired without completion → full forfeit, no_payout, no refund queued", async () => {
		const deadline = new Date(Date.now() - 60 * DAY); // past the 50-day cap
		await paidOrder({ deadline });

		const count = await service.resolveExpired();
		expect(count).toBe(1);

		const txn = await prisma.earnBackTransaction.findFirst({
			where: { userId: learnerId },
		});
		expect(txn?.status).toBe("no_payout");
		expect(Number(txn?.earnBackAmount)).toBe(0);
		expect(Number(txn?.forfeitedAmount)).toBe(100);
		expect(earnBackJobs()).toHaveLength(0);
		expect(payoutJobs()).toHaveLength(1); // forfeit to instructor
		expect(emitted).toContain(PaymentEvents.EarnBackNoPayout);
	});

	it("is idempotent — resolving twice creates one transaction", async () => {
		const deadline = new Date(Date.now() + 10 * DAY);
		await paidOrder({ deadline });
		await service.resolveForCompletion(
			learnerId,
			"course",
			courseId,
			new Date(),
		);
		await service.resolveForCompletion(
			learnerId,
			"course",
			courseId,
			new Date(),
		);
		expect(
			await prisma.earnBackTransaction.count({ where: { userId: learnerId } }),
		).toBe(1);
	});

	it("platform-owned forfeiture is 100% platform — no instructor payout", async () => {
		const deadline = new Date(Date.now() - 10 * DAY);
		await paidOrder({ deadline, platformOwned: true });

		await service.resolveForCompletion(
			learnerId,
			"course",
			courseId,
			new Date(),
		);

		const txn = await prisma.earnBackTransaction.findFirst({
			where: { userId: learnerId },
		});
		expect(Number(txn?.forfeitedPlatformCut)).toBe(20);
		expect(Number(txn?.forfeitedInstructorCut)).toBe(0);
		expect(payoutJobs()).toHaveLength(0);
	});
});
