/**
 * Pure Earn-Back deadline rules (§4.11.1, §6.4 "pure calculators" — no Prisma,
 * no I/O, no clock beyond what's passed in).
 *
 * Three parties can decide a learner's deadline, and exactly one does:
 *
 * - **creator** — the course/path fixed a window. Binding; the learner cannot
 *   change it. They only need to *see* it.
 * - **provisional** — the creator left it open (a Cohort always does — it has
 *   no window field at all), so the platform max stands until the learner
 *   commits. This keeps escrow resolvable: there is never an order without a
 *   deadline, so money can never be stranded waiting on a choice nobody made.
 * - **learner** — the learner has committed. **Locked forever after.**
 *
 * The lock is the whole point. Earn-Back is a commitment device (Ariely &
 * Wertenbroch, 2002 — see §1 Behavioural Foundations); a deadline you can push
 * back the moment it's inconvenient is just a suggestion. So a learner commits
 * once, and only ever to something *at or inside* the provisional window — they
 * can promise to finish sooner, never later.
 */

export type EarnBackDeadlineSourceName = "creator" | "provisional" | "learner";

/** The frozen order fields this rule reads — nothing else is relevant. */
export interface DeadlineOrderView {
	isEarnBackEligible: boolean;
	status: string | null;
	/** The frozen window: the creator's days, or the platform max. */
	earnBackDeadlineDays: number | null;
	earnBackDeadlineSource: EarnBackDeadlineSourceName | null;
}

/**
 * May this learner still choose their own deadline? Only on a settled,
 * earn-back-eligible order the creator left open and the learner hasn't yet
 * answered. Everything else — creator-fixed, already committed, unpaid, or
 * already resolved — is a no.
 */
export function canLearnerSetDeadline(order: DeadlineOrderView): boolean {
	return (
		order.isEarnBackEligible &&
		order.status === "paid" &&
		order.earnBackDeadlineSource === "provisional"
	);
}

export type DeadlineRejection =
	| "not_eligible"
	| "not_settled"
	| "fixed_by_creator"
	| "already_set"
	| "out_of_range";

/**
 * Why a commit is refused, or null when it's allowed. Returns the *specific*
 * reason so the API can say which rule was hit rather than a blanket "no".
 */
export function rejectDeadlineCommit(
	order: DeadlineOrderView,
	days: number,
): DeadlineRejection | null {
	if (!order.isEarnBackEligible) return "not_eligible";
	if (order.status !== "paid") return "not_settled";
	if (order.earnBackDeadlineSource === "creator") return "fixed_by_creator";
	if (order.earnBackDeadlineSource === "learner") return "already_set";
	if (!Number.isInteger(days) || days < 1) return "out_of_range";
	// Never past the window frozen at purchase — the learner may only promise to
	// finish sooner, and a later Admin change can't move their goalposts.
	const max = order.earnBackDeadlineDays;
	if (max != null && days > max) return "out_of_range";
	return null;
}

/** The deadline instant for a committed number of days, measured from payment. */
export function deadlineFrom(paidAt: Date, days: number): Date {
	return new Date(paidAt.getTime() + days * 24 * 60 * 60 * 1000);
}
