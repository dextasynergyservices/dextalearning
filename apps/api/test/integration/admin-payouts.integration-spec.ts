import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPayoutsService } from "../../src/modules/payments/admin-payouts.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";

describe("AdminPayoutsService (integration)", () => {
	const prisma = getTestPrisma();
	const queue = { add: vi.fn() } as unknown as Queue;
	const earnBackQueue = { add: vi.fn() } as unknown as Queue;
	const service = new AdminPayoutsService(prisma, queue, earnBackQueue);

	let payableId: string;
	let unpayableId: string;
	beforeEach(async () => {
		(queue.add as ReturnType<typeof vi.fn>).mockClear();
		(earnBackQueue.add as ReturnType<typeof vi.fn>).mockClear();
		const withAccount = await createUser(prisma, { role: "instructor" });
		const without = await createUser(prisma, { role: "instructor" });
		payableId = withAccount.id;
		unpayableId = without.id;
		// Only the first instructor has a default verified account.
		await prisma.payoutAccount.create({
			data: {
				userId: payableId,
				provider: "paystack",
				verified: true,
				isDefault: true,
				accountJson: { accountNumber: "0123456789" },
			},
		});
		await prisma.instructorPayout.createMany({
			data: [
				{
					instructorId: payableId,
					amount: 90,
					currency: "NGN",
					status: "pending",
				},
				{
					instructorId: payableId,
					amount: 45,
					currency: "NGN",
					status: "pending",
				},
				{
					instructorId: unpayableId,
					amount: 30,
					currency: "NGN",
					status: "pending",
				},
			],
		});
	});

	it("groups pending payouts by instructor with a payable flag", async () => {
		const { groups, totalPending, payableTotal } = await service.pending();
		expect(totalPending).toBe(165);
		expect(payableTotal).toBe(135); // only the instructor with an account
		const payable = groups.find((g) => g.instructorId === payableId);
		const unpayable = groups.find((g) => g.instructorId === unpayableId);
		expect(payable?.pendingCount).toBe(2);
		expect(payable?.pendingTotal).toBe(135);
		expect(payable?.payable).toBe(true);
		expect(unpayable?.payable).toBe(false);
	});

	it("bulk-run queues only payouts for payable instructors", async () => {
		const { queued, skipped } = await service.runAll();
		expect(queued).toBe(2); // the two for the instructor with an account
		expect(skipped).toBe(1); // the one without an account stays pending
		expect(queue.add).toHaveBeenCalledTimes(2);
		// Regression: BullMQ job ids never contain ":".
		for (const call of (queue.add as ReturnType<typeof vi.fn>).mock.calls) {
			expect((call[2] as { jobId: string }).jobId).not.toContain(":");
		}
	});

	it("retries a failed payout (reset to pending + enqueue)", async () => {
		const failed = await prisma.instructorPayout.create({
			data: {
				instructorId: payableId,
				amount: 10,
				currency: "NGN",
				status: "failed",
				failedReason: "boom",
			},
			select: { id: true },
		});
		const res = await service.retry(failed.id);
		expect(res.queued).toBe(true);
		const row = await prisma.instructorPayout.findUnique({
			where: { id: failed.id },
		});
		expect(row?.status).toBe("pending");
		expect(row?.failedReason).toBeNull();
		expect(queue.add).toHaveBeenCalledTimes(1);
	});

	/**
	 * The learner's leg (§4.11.5). The worker gives up after 5 attempts; without
	 * this, a failed refund strands the learner's own money with no recovery
	 * path but hand-editing the database.
	 */
	describe("failed Earn-Back refund retry", () => {
		async function failedRefund(
			overrides: {
				status?: "pending" | "processed" | "failed" | "no_payout";
				amount?: number;
				providerRef?: string | null;
			} = {},
		) {
			const learnerUser = await createUser(prisma, { role: "learner" });
			const order = await prisma.order.create({
				data: {
					userId: learnerUser.id,
					entityType: "course",
					entityId: crypto.randomUUID(),
					entityTitle: "Test course",
					amount: 100,
					currency: "NGN",
					status: "earn_back_issued",
					providerRef:
						overrides.providerRef === undefined
							? "ref-123"
							: overrides.providerRef,
				},
				select: { id: true },
			});
			return prisma.earnBackTransaction.create({
				data: {
					orderId: order.id,
					userId: learnerUser.id,
					amountPaid: 100,
					daysLate: 0,
					earnBackAmount: overrides.amount ?? 95,
					forfeitedAmount: 0,
					currency: "NGN",
					status: overrides.status ?? "failed",
					failedReason: "gateway timeout",
				},
				select: { id: true },
			});
		}

		it("resets a failed refund to pending and re-queues it", async () => {
			const txn = await failedRefund();
			const res = await service.retryRefund(txn.id);

			expect(res.queued).toBe(true);
			const row = await prisma.earnBackTransaction.findUnique({
				where: { id: txn.id },
			});
			expect(row?.status).toBe("pending");
			expect(row?.failedReason).toBeNull();
			expect(earnBackQueue.add).toHaveBeenCalledTimes(1);
		});

		/**
		 * The original enqueue uses a stable `earnback-${id}`. Reusing it here
		 * would let BullMQ deduplicate the job — the retry would report success
		 * and silently do nothing.
		 */
		it("uses a unique jobId so BullMQ can't dedupe the retry away", async () => {
			const txn = await failedRefund();
			await service.retryRefund(txn.id);

			const opts = (earnBackQueue.add as ReturnType<typeof vi.fn>).mock
				.calls[0][2];
			expect(opts.jobId).not.toBe(`earnback-${txn.id}`);
			expect(opts.jobId).toContain(txn.id);
			// BullMQ rejects custom ids containing ":" — the Phase 7 live-drive bug.
			expect(opts.jobId).not.toContain(":");
		});

		it("refuses a forfeited Earn-Back — there is nothing to send", async () => {
			const txn = await failedRefund({ status: "no_payout", amount: 0 });
			await expect(service.retryRefund(txn.id)).rejects.toThrow(/forfeited/i);
			expect(earnBackQueue.add).not.toHaveBeenCalled();
		});

		it("refuses when the original charge reference is gone", async () => {
			const txn = await failedRefund({ providerRef: null });
			await expect(service.retryRefund(txn.id)).rejects.toThrow(/manual/i);
			expect(earnBackQueue.add).not.toHaveBeenCalled();
		});

		it("is a no-op on an already-processed refund", async () => {
			const txn = await failedRefund({ status: "processed" });
			await expect(service.retryRefund(txn.id)).resolves.toEqual({
				queued: false,
			});
			expect(earnBackQueue.add).not.toHaveBeenCalled();
		});
	});
});
