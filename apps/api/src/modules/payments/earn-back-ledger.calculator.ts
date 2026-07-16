/**
 * Pure per-sale outcome math for the instructor's Earn-Back ledger (§8.5, §6.4
 * "pure calculators" — no Prisma, no I/O). Maps ONE frozen Order (plus its
 * resolved earn-back transaction, if any) to what the creator actually earned
 * from that sale, and why.
 *
 * MONEY IS INTEGER MINOR UNITS (kobo/cents), same contract as the revenue-split
 * and earn-back calculators.
 *
 * This exists because `instructor_payouts` is the CASH ledger — it answers
 * "what did we transfer?" — and the creator also needs the COMMERCIAL ledger:
 * "what happened to my sale?". They diverge most sharply at e = 100, where a
 * learner finishing on time forfeits nothing, so no payout row is ever written
 * and a real sale leaves no trace in cash at all (§4.11.5). Reading the cash
 * table to answer the commercial question renders that sale — and the platform's
 * best possible outcome — as silence.
 *
 * Everything here reads the ORDER SNAPSHOT (§4.11.2), never the live catalogue,
 * so a later percentage or price edit can't restate historical earnings.
 */

import { splitRevenue } from "./revenue-split.calculator";

/** What became of one sale, from the creator's side. */
export type SaleOutcome =
	/** No Earn-Back on this sale — the creator's cut settled at checkout. */
	| "settled"
	/** Earn-Back escrowed, deadline still open — nothing decided yet. */
	| "at_stake"
	/** Learner finished on time: they earned it all back, the creator earns 0. */
	| "finished_on_time"
	/** Learner finished late: the creator earns the forfeited slice. */
	| "finished_late"
	/** Window lapsed / ≥50 days late: the whole base forfeits to revenue. */
	| "deadline_missed";

export interface SaleLedgerInput {
	/** Earn-Back was ON for this sale (frozen at order time). */
	isEarnBackEligible: boolean;
	/** Frozen Earn-Back Base B, in minor units. */
	earnBackBaseMinor: number;
	/** The creator's frozen cut of guaranteed revenue N — paid at checkout. */
	instructorAmountMinor: number;
	/** Frozen instructor revenue share (default 90). */
	instructorSharePct: number;
	/** Platform-owned content earns the creator nothing. */
	isPlatformOwned: boolean;
	/** `paid` = escrow open; `earn_back_issued` = resolved. */
	orderStatus: string | null;
	/** The resolution, once it exists. Null while escrow is open. */
	resolution: {
		daysLate: number;
		forfeitedAmountMinor: number;
		forfeitedInstructorCutMinor: number;
	} | null;
}

export interface SaleLedgerResult {
	outcome: SaleOutcome;
	/** Already paid: the creator's cut of guaranteed revenue, settled at checkout. */
	guaranteedMinor: number;
	/**
	 * The creator's MAXIMUM remaining upside from escrow, if the learner forfeits
	 * everything. Non-zero only while `at_stake` — it is explicitly not money the
	 * creator has, and at e = 100 an on-time finish takes all of it to 0.
	 */
	atStakeMinor: number;
	/** Actually earned from escrow once resolved (the forfeited 90% slice). */
	earnedFromEscrowMinor: number;
	/** Total the sale has actually earned the creator so far. */
	totalEarnedMinor: number;
}

/**
 * Resolve one sale. `at_stake` reports the ceiling (full forfeit), never a
 * promise — the copy layer is responsible for saying "only if they miss it".
 */
export function calculateSaleLedger(input: SaleLedgerInput): SaleLedgerResult {
	const guaranteedMinor = Math.max(0, Math.round(input.instructorAmountMinor));
	const base = Math.max(0, Math.round(input.earnBackBaseMinor));

	// No escrow ⇒ the sale is fully decided at checkout, nothing to track.
	if (!input.isEarnBackEligible || base <= 0) {
		return {
			outcome: "settled",
			guaranteedMinor,
			atStakeMinor: 0,
			earnedFromEscrowMinor: 0,
			totalEarnedMinor: guaranteedMinor,
		};
	}

	// Escrow still open: report the ceiling the creator could win.
	if (input.orderStatus !== "earn_back_issued" || !input.resolution) {
		const { instructorAmountMinor } = splitRevenue(
			base,
			input.instructorSharePct,
			input.isPlatformOwned,
		);
		return {
			outcome: "at_stake",
			guaranteedMinor,
			atStakeMinor: instructorAmountMinor,
			earnedFromEscrowMinor: 0,
			totalEarnedMinor: guaranteedMinor,
		};
	}

	const { daysLate, forfeitedAmountMinor, forfeitedInstructorCutMinor } =
		input.resolution;
	const earnedFromEscrowMinor = Math.max(0, forfeitedInstructorCutMinor);

	// The three resolved outcomes, in order of how the learner behaved. On-time
	// is decided by daysLate — NOT by "earned nothing" — so a creator on
	// platform-owned or 0%-share content still reads the learner's behaviour
	// correctly rather than seeing every sale as a missed deadline.
	const outcome: SaleOutcome =
		daysLate <= 0
			? "finished_on_time"
			: forfeitedAmountMinor >= base
				? "deadline_missed"
				: "finished_late";

	return {
		outcome,
		guaranteedMinor,
		atStakeMinor: 0,
		earnedFromEscrowMinor,
		totalEarnedMinor: guaranteedMinor + earnedFromEscrowMinor,
	};
}

export interface LedgerSummary {
	salesCount: number;
	/** What learners actually paid, gross. Context for the earned figure. */
	grossMinor: number;
	/** Total actually earned across every sale (guaranteed + forfeited slices). */
	earnedMinor: number;
	/** Ceiling still riding on open escrows. */
	atStakeMinor: number;
	/**
	 * Learners who finished inside the deadline. THE headline metric at high e:
	 * it's the number that turns an empty earnings page from "nobody bought this"
	 * into "everybody who bought it finished".
	 */
	finishedOnTimeCount: number;
}

/** Fold per-sale results into the summary. Pure; order-independent. */
export function summariseLedger(
	rows: { grossMinor: number; result: SaleLedgerResult }[],
): LedgerSummary {
	return rows.reduce<LedgerSummary>(
		(acc, { grossMinor, result }) => ({
			salesCount: acc.salesCount + 1,
			grossMinor: acc.grossMinor + Math.max(0, grossMinor),
			earnedMinor: acc.earnedMinor + result.totalEarnedMinor,
			atStakeMinor: acc.atStakeMinor + result.atStakeMinor,
			finishedOnTimeCount:
				acc.finishedOnTimeCount +
				(result.outcome === "finished_on_time" ? 1 : 0),
		}),
		{
			salesCount: 0,
			grossMinor: 0,
			earnedMinor: 0,
			atStakeMinor: 0,
			finishedOnTimeCount: 0,
		},
	);
}
