import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
	type EarnBackJobData,
	type InstructorPayoutJobData,
	QUEUE_EARN_BACK,
	QUEUE_INSTRUCTOR_PAYOUT,
} from "../../shared/queue/queue.constants";
import { QUEUE_PORT, type QueuePort } from "../../shared/queue/queue.port";

/**
 * Admin payout oversight + bulk payout (§14.3). Instructors accumulate `pending`
 * payouts (e.g. before they verify an account); Admin sees the outstanding
 * amounts grouped by instructor and can trigger a bulk run that re-enqueues
 * every eligible pending payout. Read-only elsewhere — the durable worker still
 * performs the actual transfers, so this never moves money directly.
 */
export interface PendingPayoutGroup {
	instructorId: string;
	instructorName: string;
	pendingCount: number;
	pendingTotal: number;
	currency: string;
	/** Whether the instructor has a default verified account to pay into. */
	payable: boolean;
}

export interface AdminPayoutRow {
	id: string;
	instructorId: string | null;
	instructorName: string;
	amount: number;
	currency: string;
	status: "pending" | "processed" | "failed" | null;
	entityTitle: string | null;
	triggeredAt: string;
	processedAt: string | null;
	failedReason: string | null;
}

/**
 * A learner Earn-Back refund. Money out of the platform on the OTHER leg of §2:
 * an instructor payout pays a creator, this refunds a learner. Distinct table,
 * distinct worker — but the same Admin question ("did the money move?"), so it
 * lives on the same page.
 */
export interface AdminRefundRow {
	id: string;
	learnerId: string | null;
	learnerName: string;
	amount: number;
	currency: string;
	status: "pending" | "processed" | "failed" | "no_payout" | null;
	entityTitle: string | null;
	daysLate: number;
	calculatedAt: string;
	processedAt: string | null;
	failedReason: string | null;
}

@Injectable()
export class AdminPayoutsService {
	private readonly logger = new Logger(AdminPayoutsService.name);

	constructor(
		private readonly prisma: PrismaService,
		@Inject(QUEUE_PORT) private readonly queue: QueuePort,
	) {}

	/** Outstanding pending payouts grouped by instructor, with payability. */
	async pending(): Promise<{
		groups: PendingPayoutGroup[];
		totalPending: number;
		payableTotal: number;
	}> {
		const grouped = await this.prisma.instructorPayout.groupBy({
			by: ["instructorId", "currency"],
			where: { status: "pending", instructorId: { not: null } },
			_sum: { amount: true },
			_count: { _all: true },
		});
		const ids = [
			...new Set(grouped.map((g) => g.instructorId).filter(Boolean)),
		] as string[];
		const [users, verifiedAccounts] = await Promise.all([
			this.prisma.user.findMany({
				where: { id: { in: ids } },
				select: { id: true, fullName: true, firstName: true, lastName: true },
			}),
			this.prisma.payoutAccount.findMany({
				where: { userId: { in: ids }, isDefault: true, verified: true },
				select: { userId: true },
			}),
		]);
		const nameOf = new Map(
			users.map((u) => [
				u.id,
				u.fullName?.trim() ||
					`${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() ||
					"Instructor",
			]),
		);
		const payableSet = new Set(verifiedAccounts.map((a) => a.userId));

		let totalPending = 0;
		let payableTotal = 0;
		const groups: PendingPayoutGroup[] = grouped.map((g) => {
			const total = Number(g._sum.amount ?? 0);
			totalPending += total;
			const payable = payableSet.has(g.instructorId as string);
			if (payable) payableTotal += total;
			return {
				instructorId: g.instructorId as string,
				instructorName: nameOf.get(g.instructorId as string) ?? "Instructor",
				pendingCount: g._count._all,
				pendingTotal: total,
				currency: g.currency ?? "NGN",
				payable,
			};
		});
		groups.sort((a, b) => b.pendingTotal - a.pendingTotal);
		return { groups, totalPending, payableTotal };
	}

	/**
	 * Re-enqueue every pending payout whose instructor has a default verified
	 * account. Idempotent per job (stable jobId) so a double-click can't
	 * double-pay. Returns how many were queued.
	 */
	async runAll(): Promise<{ queued: number; skipped: number }> {
		const pending = await this.prisma.instructorPayout.findMany({
			where: { status: "pending", instructorId: { not: null } },
			select: { id: true, instructorId: true },
		});
		const payableIds = new Set(
			(
				await this.prisma.payoutAccount.findMany({
					where: {
						isDefault: true,
						verified: true,
						userId: {
							in: [...new Set(pending.map((p) => p.instructorId))] as string[],
						},
					},
					select: { userId: true },
				})
			).map((a) => a.userId),
		);

		let queued = 0;
		let skipped = 0;
		for (const p of pending) {
			if (!payableIds.has(p.instructorId as string)) {
				skipped += 1;
				continue;
			}
			await this.queue.enqueue<InstructorPayoutJobData>(
				QUEUE_INSTRUCTOR_PAYOUT,
				{ payoutId: p.id },
				{ jobId: `payout-${p.id}`, attempts: 5, backoffMs: 30_000 },
			);
			queued += 1;
		}
		this.logger.log(`Admin bulk payout: queued ${queued}, skipped ${skipped}`);
		return { queued, skipped };
	}

	/** Retry a single failed payout (reset to pending + re-enqueue). */
	async retry(payoutId: string): Promise<{ queued: boolean }> {
		const payout = await this.prisma.instructorPayout.findUnique({
			where: { id: payoutId },
			select: { id: true, status: true },
		});
		if (!payout) throw new NotFoundException("Payout not found");
		if (payout.status === "processed") return { queued: false };
		await this.prisma.instructorPayout.update({
			where: { id: payoutId },
			data: { status: "pending", failedReason: null },
		});
		await this.queue.enqueue<InstructorPayoutJobData>(
			QUEUE_INSTRUCTOR_PAYOUT,
			{ payoutId },
			{
				jobId: `payout-retry-${payoutId}-${Date.now()}`,
				attempts: 5,
				backoffMs: 30_000,
			},
		);
		return { queued: true };
	}

	/**
	 * Retry a failed learner Earn-Back refund (§4.11.5). The mirror of `retry()`
	 * above, and just as necessary: the worker gives up after 5 attempts, which
	 * strands a learner's own money with no recovery path but hand-editing the
	 * database. This is the learner's leg of the same obligation.
	 *
	 * `no_payout` is refused rather than retried — there is no refund to send
	 * (the base was fully forfeited), so re-queueing it would be a no-op that
	 * looks like an action.
	 */
	async retryRefund(transactionId: string): Promise<{ queued: boolean }> {
		const txn = await this.prisma.earnBackTransaction.findUnique({
			where: { id: transactionId },
			select: {
				id: true,
				status: true,
				earnBackAmount: true,
				order: { select: { providerRef: true } },
			},
		});
		if (!txn) throw new NotFoundException("Earn-Back transaction not found");
		if (txn.status === "processed") return { queued: false };
		if (txn.status === "no_payout" || Number(txn.earnBackAmount ?? 0) <= 0) {
			throw new BadRequestException(
				"This Earn-Back was forfeited — there is nothing to refund.",
			);
		}
		// The worker refunds the ORIGINAL charge; without its reference it can
		// only fail again. Say so here rather than burning five more attempts.
		if (!txn.order?.providerRef) {
			throw new BadRequestException(
				"The original payment reference is missing — this refund needs manual recovery.",
			);
		}

		await this.prisma.earnBackTransaction.update({
			where: { id: transactionId },
			data: { status: "pending", failedReason: null },
		});
		await this.queue.enqueue<EarnBackJobData>(
			QUEUE_EARN_BACK,
			{ transactionId },
			{
				// A UNIQUE jobId per retry. The original enqueue uses the stable
				// `earnback-${id}`, which the queue deduplicates — the retry would
				// silently no-op while reporting success.
				jobId: `earnback-retry-${transactionId}-${Date.now()}`,
				attempts: 5,
				backoffMs: 60_000,
			},
		);
		this.logger.log(`Admin re-queued Earn-Back refund ${transactionId}`);
		return { queued: true };
	}

	/** Recent payouts across all instructors for oversight. */
	async recent(limit = 100): Promise<AdminPayoutRow[]> {
		const rows = await this.prisma.instructorPayout.findMany({
			orderBy: { triggeredAt: "desc" },
			take: Math.min(200, Math.max(1, limit)),
			include: {
				order: { select: { entityTitle: true } },
				instructor: {
					select: { fullName: true, firstName: true, lastName: true },
				},
			},
		});
		return rows.map((r) => ({
			id: r.id,
			instructorId: r.instructorId,
			instructorName:
				r.instructor?.fullName?.trim() ||
				`${r.instructor?.firstName ?? ""} ${r.instructor?.lastName ?? ""}`.trim() ||
				"Instructor",
			amount: Number(r.amount ?? 0),
			currency: r.currency ?? "NGN",
			status: r.status,
			entityTitle: r.order?.entityTitle ?? null,
			triggeredAt: r.triggeredAt.toISOString(),
			processedAt: r.processedAt?.toISOString() ?? null,
			failedReason: r.failedReason,
		}));
	}

	/**
	 * Recent learner Earn-Back refunds for oversight. Without this an Admin
	 * looking at an empty payouts table concludes "nothing happened", when in
	 * fact a learner was refunded in full — the on-time, e=100 case forfeits
	 * nothing, so it produces a refund and NO instructor payout by design.
	 * It also gives `earn_back_failed_admin` somewhere to actually point.
	 */
	async recentRefunds(limit = 100): Promise<AdminRefundRow[]> {
		const rows = await this.prisma.earnBackTransaction.findMany({
			orderBy: { calculatedAt: "desc" },
			take: Math.min(200, Math.max(1, limit)),
			include: {
				order: { select: { entityTitle: true } },
				user: { select: { fullName: true, firstName: true, lastName: true } },
			},
		});
		return rows.map((r) => ({
			id: r.id,
			learnerId: r.userId,
			learnerName:
				r.user?.fullName?.trim() ||
				`${r.user?.firstName ?? ""} ${r.user?.lastName ?? ""}`.trim() ||
				"Learner",
			amount: Number(r.earnBackAmount ?? 0),
			currency: r.currency ?? "NGN",
			status: r.status as AdminRefundRow["status"],
			entityTitle: r.order?.entityTitle ?? null,
			daysLate: r.daysLate,
			calculatedAt: r.calculatedAt.toISOString(),
			processedAt: r.processedAt?.toISOString() ?? null,
			failedReason: r.failedReason,
		}));
	}
}
