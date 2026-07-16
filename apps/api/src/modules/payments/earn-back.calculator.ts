/**
 * Pure Earn-Back resolution math (§4.11.4, §6.4 "pure calculators" — no Prisma,
 * no I/O, no gateway). Run when a learner satisfies ALL completion criteria (or
 * when the deadline lapses), off the frozen Order snapshot — never a live
 * catalogue lookup (§4.11.2).
 *
 * MONEY IS INTEGER MINOR UNITS (kobo/cents), same contract as the revenue-split
 * calculator; no floats, no rounding drift. Forfeited + Earn-Back always
 * re-sum to the base B exactly.
 *
 *   Earn-Back Base   B = e × P            (frozen at order time; escrowed)
 *   Earn-Back Amount = B × (1 − 0.02·D)   (refunded to learner's payment method)
 *   Forfeited        = B × 0.02 × D       (distributed as revenue, 90/10)
 *
 *   D = whole days finished AFTER the deadline (0 = on time or early)
 *   D capped at 50 ⇒ max deduction = 100% of the BASE B (never of P)
 *
 * The forfeited pool is distributed by the SAME constant 90/10 split as
 * guaranteed revenue (§14.2) via the shared `splitRevenue` helper, so both
 * "money that settles as revenue" paths round identically.
 */

import { splitRevenue } from "./revenue-split.calculator";

/** Per-day tardiness deduction: 2% of the base (§4.11.4). */
const DEDUCTION_PCT_PER_DAY = 2;
/** D is capped at 50 days ⇒ 50 × 2% = 100% of the base forfeited. */
const MAX_LATE_DAYS = 50;

export interface EarnBackInput {
	/** Frozen Earn-Back Base B, in integer minor units. B = 0 ⇒ no earn-back. */
	earnBackBaseMinor: number;
	/** Whole days finished after the deadline; negatives (early) clamp to 0. */
	daysLate: number;
	/** Instructor revenue share for the forfeited distribution (default 90). */
	instructorSharePct: number;
	/** Platform-owned content keeps 100% of the forfeited revenue. */
	isPlatformOwned: boolean;
}

export interface EarnBackResult {
	/** Days late after clamping to [0, 50] — what the deduction actually used. */
	daysLate: number;
	/** Refunded to the learner's original payment method. */
	earnBackAmountMinor: number;
	/** Forfeited portion of the base, distributed as revenue. */
	forfeitedAmountMinor: number;
	/** Instructor's 90% of the forfeited amount (0 for platform-owned). */
	forfeitedInstructorCutMinor: number;
	/** Platform's 10% of the forfeited amount (100% for platform-owned). */
	forfeitedPlatformCutMinor: number;
	/**
	 * True when there is nothing to refund (base 0, or ≥ 50 days late) — the
	 * caller records the transaction as `no_payout` instead of queueing a
	 * gateway refund. Certificate is issued either way (§4.11.5).
	 */
	isNoPayout: boolean;
}

export function calculateEarnBack(input: EarnBackInput): EarnBackResult {
	const base = Math.max(0, Math.round(input.earnBackBaseMinor));
	const daysLate = Math.min(
		MAX_LATE_DAYS,
		Math.max(0, Math.floor(input.daysLate)),
	);

	// Forfeited rounds so learner refund + forfeited re-sum to the base exactly;
	// capped at the base so a rounding edge can never over-forfeit.
	const forfeitedAmountMinor = Math.min(
		base,
		Math.round((base * DEDUCTION_PCT_PER_DAY * daysLate) / 100),
	);
	const earnBackAmountMinor = base - forfeitedAmountMinor;

	const { instructorAmountMinor, platformAmountMinor } = splitRevenue(
		forfeitedAmountMinor,
		input.instructorSharePct,
		input.isPlatformOwned,
	);

	return {
		daysLate,
		earnBackAmountMinor,
		forfeitedAmountMinor,
		forfeitedInstructorCutMinor: instructorAmountMinor,
		forfeitedPlatformCutMinor: platformAmountMinor,
		isNoPayout: earnBackAmountMinor <= 0,
	};
}

/**
 * Whole days `finishedAt` lands after `deadline` (0 when on time or early).
 * Both are compared as instants; partial days round DOWN so finishing 3h late
 * on the deadline day is not counted as a full day late. Pure — the service
 * supplies the two dates off the snapshot + completion record.
 */
export function daysLate(deadline: Date, finishedAt: Date): number {
	const ms = finishedAt.getTime() - deadline.getTime();
	if (ms <= 0) return 0;
	return Math.floor(ms / (24 * 60 * 60 * 1000));
}
