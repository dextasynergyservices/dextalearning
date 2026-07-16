import {
	Injectable,
	Logger,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { EnrollableType } from "../enrollment/enrollment.service";
import {
	type DeadlineOrderView,
	type DeadlineRejection,
	deadlineFrom,
	rejectDeadlineCommit,
} from "./earn-back-deadline.calculator";

/** Fallback copy — the client localizes off `details.reason` (§8 i18n). */
const REJECTION_MESSAGES: Record<DeadlineRejection, string> = {
	not_eligible: "This content has no Earn-Back.",
	not_settled: "Your payment is still being confirmed.",
	fixed_by_creator: "The deadline for this one is set by its creator.",
	already_set: "You've already set your deadline for this one.",
	out_of_range: "Choose a number of days within your Earn-Back window.",
};

/**
 * The learner's Earn-Back deadline commitment (§4.11.1) — one job, kept apart
 * from both the checkout/settlement flow (PaymentsService) and the resolution
 * engine (EarnBackService), which have no business deciding it.
 *
 * The *rules* live in `earn-back-deadline.calculator.ts` and are shared with the
 * status read, so "can I set it?" and "may I set it?" can never disagree. This
 * service only does the I/O: find the learner's order, apply the rule, write.
 */
@Injectable()
export class EarnBackDeadlineService {
	private readonly logger = new Logger(EarnBackDeadlineService.name);

	constructor(private readonly prisma: PrismaService) {}

	/** The learner's most recent settled order for this entity. */
	private findOrder(userId: string, type: EnrollableType, entityId: string) {
		return this.prisma.order.findFirst({
			where: {
				userId,
				entityType: type,
				entityId,
				status: { in: ["paid", "earn_back_issued"] },
			},
			orderBy: { createdAt: "desc" },
		});
	}

	/**
	 * Commit the learner to finishing within `days` of their payment. Allowed
	 * once, only when the creator left the window open, and only for a value at
	 * or inside the window frozen at purchase.
	 */
	async setDeadline(
		userId: string,
		type: EnrollableType,
		entityId: string,
		days: number,
	): Promise<{ deadline: string; days: number }> {
		const order = await this.findOrder(userId, type, entityId);
		if (!order) throw new NotFoundException("No enrolment found for this");

		const view: DeadlineOrderView = {
			isEarnBackEligible: order.isEarnBackEligible,
			status: order.status,
			earnBackDeadlineDays: order.earnBackDeadlineDays,
			earnBackDeadlineSource: order.earnBackDeadlineSource,
		};
		const rejection = rejectDeadlineCommit(view, days);
		if (rejection) {
			throw new UnprocessableEntityException({
				code: "DEADLINE_NOT_ALLOWED",
				message: REJECTION_MESSAGES[rejection],
				details: { reason: rejection, maxDays: order.earnBackDeadlineDays },
			});
		}

		// The window runs from payment, not from this moment — otherwise a learner
		// could quietly buy themselves more time by choosing late.
		const paidAt = order.paidAt ?? order.createdAt;
		const deadline = deadlineFrom(paidAt, days);

		// Guarded update: `provisional` in the WHERE makes the once-only rule
		// atomic, so two racing requests can't both commit.
		const updated = await this.prisma.order.updateMany({
			where: { id: order.id, earnBackDeadlineSource: "provisional" },
			data: {
				earnBackDeadline: deadline,
				earnBackDeadlineDays: days,
				earnBackDeadlineSource: "learner",
				earnBackDeadlineSetAt: new Date(),
			},
		});
		if (updated.count === 0) {
			throw new UnprocessableEntityException({
				code: "DEADLINE_NOT_ALLOWED",
				message: REJECTION_MESSAGES.already_set,
				details: { reason: "already_set" as DeadlineRejection },
			});
		}

		this.logger.log(
			`Learner ${userId} committed to ${days} days on order ${order.id} (${deadline.toISOString()})`,
		);
		return { deadline: deadline.toISOString(), days };
	}
}
