import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Order } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
	type EarnBackNoPayoutEvent,
	PaymentEvents,
} from "../../shared/events/payment-events";
import {
	type EarnBackJobData,
	type InstructorPayoutJobData,
	QUEUE_EARN_BACK,
	QUEUE_INSTRUCTOR_PAYOUT,
} from "../../shared/queue/queue.constants";
import { QUEUE_PORT, type QueuePort } from "../../shared/queue/queue.port";
import type { EnrollableType } from "../enrollment/enrollment.service";
import { calculateEarnBack, daysLate } from "./earn-back.calculator";

/** Minor units → major-unit number for Decimal columns. */
function toMajor(minor: number): number {
	return Math.round(minor) / 100;
}
function toMinor(major: unknown): number {
	return Math.round(Number(major ?? 0) * 100);
}

/**
 * Earn-Back resolution engine (§4.11.4/§4.11.5). When a learner satisfies ALL
 * completion criteria (or the window fully lapses), it computes the refund off
 * the FROZEN Order snapshot — never the live catalogue — records an
 * `earn_back_transactions` row, distributes the forfeited portion as revenue
 * (90/10 via instructor_payout.queue), and queues the learner refund on
 * earn_back.queue. Idempotent: the `paid → earn_back_issued` status flip is the
 * single resolution gate, so completion + cron can't both resolve one order.
 */
@Injectable()
export class EarnBackService {
	private readonly logger = new Logger(EarnBackService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly events: EventEmitter2,
		@Inject(QUEUE_PORT) private readonly queue: QueuePort,
	) {}

	/**
	 * Resolve on completion — the learner finished, so the refund is based on how
	 * late (if at all) they finished relative to the frozen deadline. No paid
	 * earn-back order ⇒ nothing to do (free content, already resolved, or off).
	 */
	async resolveForCompletion(
		userId: string,
		entityType: EnrollableType,
		entityId: string,
		completedAt: Date,
	): Promise<void> {
		const order = await this.prisma.order.findFirst({
			where: {
				userId,
				entityType,
				entityId,
				status: "paid",
				isEarnBackEligible: true,
			},
		});
		if (!order) return;
		await this.resolve(order, completedAt);
	}

	/**
	 * Cron sweep (§4.11.3): orders whose window has fully lapsed (deadline + the
	 * 50-day tardiness cap) with the learner still not complete — the base is
	 * fully forfeited (no refund) and released to the instructor. Completed-late
	 * learners were already resolved by `resolveForCompletion`.
	 */
	async resolveExpired(now = new Date()): Promise<number> {
		const cutoff = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000);
		const due = await this.prisma.order.findMany({
			where: {
				status: "paid",
				isEarnBackEligible: true,
				earnBackDeadline: { not: null, lt: cutoff },
			},
			take: 200,
		});
		let resolved = 0;
		for (const order of due) {
			// Skip if the learner has since completed — that path resolves itself.
			const completion = await this.prisma.completionStatus.findFirst({
				where: {
					userId: order.userId ?? undefined,
					entityType: order.entityType ?? undefined,
					entityId: order.entityId ?? undefined,
					isComplete: true,
				},
				select: { id: true },
			});
			if (completion) continue;
			await this.resolve(order, null); // null ⇒ full forfeit
			resolved += 1;
		}
		return resolved;
	}

	/**
	 * Core resolution. `completedAt = null` means the window lapsed without
	 * completion → maximum tardiness (full forfeit). The status flip guards
	 * against double resolution.
	 */
	private async resolve(order: Order, completedAt: Date | null): Promise<void> {
		const baseMinor = toMinor(order.earnBackBase);
		const deadline = order.earnBackDeadline;
		const late = completedAt && deadline ? daysLate(deadline, completedAt) : 50;

		const result = calculateEarnBack({
			earnBackBaseMinor: baseMinor,
			daysLate: late,
			instructorSharePct: order.revenueSplitPct ?? 90,
			isPlatformOwned: order.isPlatformOwned,
		});

		const payoutId = await this.prisma.$transaction(async (tx) => {
			const flip = await tx.order.updateMany({
				where: { id: order.id, status: "paid" },
				data: { status: "earn_back_issued" },
			});
			if (flip.count === 0) return null; // already resolved — idempotent

			await tx.earnBackTransaction.create({
				data: {
					orderId: order.id,
					userId: order.userId,
					amountPaid: order.amount,
					daysLate: result.daysLate,
					earnBackAmount: toMajor(result.earnBackAmountMinor),
					forfeitedAmount: toMajor(result.forfeitedAmountMinor),
					forfeitedPlatformCut: toMajor(result.forfeitedPlatformCutMinor),
					forfeitedInstructorCut: toMajor(result.forfeitedInstructorCutMinor),
					currency: order.currency,
					status: result.isNoPayout ? "no_payout" : "pending",
				},
			});

			// Forfeited revenue settles to the instructor (90/10) — platform-owned
			// keeps it all, so no payout row there.
			if (
				!order.isPlatformOwned &&
				order.instructorId &&
				result.forfeitedInstructorCutMinor > 0
			) {
				const payout = await tx.instructorPayout.create({
					data: {
						orderId: order.id,
						instructorId: order.instructorId,
						amount: toMajor(result.forfeitedInstructorCutMinor),
						currency: order.currency,
						status: "pending",
					},
					select: { id: true },
				});
				return payout.id;
			}
			return null;
		});

		if (payoutId) {
			await this.queue.enqueue<InstructorPayoutJobData>(
				QUEUE_INSTRUCTOR_PAYOUT,
				{ payoutId },
				{ jobId: `payout-${payoutId}`, attempts: 5, backoffMs: 30_000 },
			);
		}

		// Find the transaction we just wrote to drive the refund / notification.
		const txRow = await this.prisma.earnBackTransaction.findFirst({
			where: { orderId: order.id },
			orderBy: { calculatedAt: "desc" },
			select: { id: true },
		});
		if (!txRow) return; // lost the resolution race

		if (result.isNoPayout) {
			this.events.emit(PaymentEvents.EarnBackNoPayout, {
				transactionId: txRow.id,
				userId: order.userId ?? "",
				entityTitle: order.entityTitle ?? "",
			} satisfies EarnBackNoPayoutEvent);
		} else {
			await this.queue.enqueue<EarnBackJobData>(
				QUEUE_EARN_BACK,
				{ transactionId: txRow.id },
				{ jobId: `earnback-${txRow.id}`, attempts: 5, backoffMs: 60_000 },
			);
		}
		this.logger.log(
			`Earn-Back resolved for order ${order.id}: ${result.isNoPayout ? "no_payout" : `refund ${toMajor(result.earnBackAmountMinor)}`}`,
		);
	}
}
