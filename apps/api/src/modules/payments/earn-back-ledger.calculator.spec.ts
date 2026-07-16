import { describe, expect, it } from "vitest";
import {
	calculateSaleLedger,
	type SaleLedgerInput,
	summariseLedger,
} from "./earn-back-ledger.calculator";

/**
 * A ₦100 sale at e=100 with a 5% platform fee: F=500, R=9500, B=9500, N=0.
 * The creator's guaranteed cut is therefore 0 — everything rides on escrow.
 */
function sale(overrides: Partial<SaleLedgerInput> = {}): SaleLedgerInput {
	return {
		isEarnBackEligible: true,
		earnBackBaseMinor: 9_500,
		instructorAmountMinor: 0,
		instructorSharePct: 90,
		isPlatformOwned: false,
		orderStatus: "paid",
		resolution: null,
		...overrides,
	};
}

describe("calculateSaleLedger (§8.5)", () => {
	it("treats a non-earn-back sale as settled at checkout", () => {
		const r = calculateSaleLedger(
			sale({
				isEarnBackEligible: false,
				earnBackBaseMinor: 0,
				instructorAmountMinor: 8_550, // 90% of the post-fee 9500
			}),
		);
		expect(r).toEqual({
			outcome: "settled",
			guaranteedMinor: 8_550,
			atStakeMinor: 0,
			earnedFromEscrowMinor: 0,
			totalEarnedMinor: 8_550,
		});
	});

	it("reports the ceiling — not a promise — while escrow is open", () => {
		const r = calculateSaleLedger(sale());
		expect(r.outcome).toBe("at_stake");
		// 90% of the 9500 base: what they'd win on a TOTAL forfeit, and no more.
		expect(r.atStakeMinor).toBe(8_550);
		// Crucially: not yet earned. At-stake must never leak into the total.
		expect(r.totalEarnedMinor).toBe(0);
		expect(r.earnedFromEscrowMinor).toBe(0);
	});

	/** The case that started all this: e=100, finished on time, creator earns 0. */
	it("marks an on-time finish as such, earning the creator nothing at e=100", () => {
		const r = calculateSaleLedger(
			sale({
				orderStatus: "earn_back_issued",
				resolution: {
					daysLate: 0,
					forfeitedAmountMinor: 0,
					forfeitedInstructorCutMinor: 0,
				},
			}),
		);
		expect(r.outcome).toBe("finished_on_time");
		expect(r.totalEarnedMinor).toBe(0);
		// The at-stake ceiling collapses the moment it's decided — it is not
		// money the creator still has coming.
		expect(r.atStakeMinor).toBe(0);
	});

	it("credits the forfeited slice when a learner finishes late", () => {
		// 10 days late ⇒ 20% of the 9500 base forfeits = 1900; creator gets 90%.
		const r = calculateSaleLedger(
			sale({
				orderStatus: "earn_back_issued",
				resolution: {
					daysLate: 10,
					forfeitedAmountMinor: 1_900,
					forfeitedInstructorCutMinor: 1_710,
				},
			}),
		);
		expect(r.outcome).toBe("finished_late");
		expect(r.earnedFromEscrowMinor).toBe(1_710);
		expect(r.totalEarnedMinor).toBe(1_710);
	});

	it("treats a fully-forfeited base as a missed deadline", () => {
		const r = calculateSaleLedger(
			sale({
				orderStatus: "earn_back_issued",
				resolution: {
					daysLate: 50,
					forfeitedAmountMinor: 9_500,
					forfeitedInstructorCutMinor: 8_550,
				},
			}),
		);
		expect(r.outcome).toBe("deadline_missed");
		expect(r.totalEarnedMinor).toBe(8_550);
	});

	it("adds the guaranteed cut to the forfeited slice at partial earn-back", () => {
		// e=50: B=4750, N=4750 ⇒ guaranteed cut 4275 already paid at checkout.
		const r = calculateSaleLedger(
			sale({
				earnBackBaseMinor: 4_750,
				instructorAmountMinor: 4_275,
				orderStatus: "earn_back_issued",
				resolution: {
					daysLate: 5,
					forfeitedAmountMinor: 475,
					forfeitedInstructorCutMinor: 427,
				},
			}),
		);
		expect(r.guaranteedMinor).toBe(4_275);
		expect(r.earnedFromEscrowMinor).toBe(427);
		expect(r.totalEarnedMinor).toBe(4_702);
	});

	/**
	 * Outcome is decided by the learner's behaviour (daysLate), never by "the
	 * creator earned nothing" — otherwise a 0%-share sale would misreport an
	 * on-time finish as a missed deadline.
	 */
	it("reads on-time correctly even when the creator's share is zero", () => {
		const r = calculateSaleLedger(
			sale({
				instructorSharePct: 0,
				orderStatus: "earn_back_issued",
				resolution: {
					daysLate: 0,
					forfeitedAmountMinor: 0,
					forfeitedInstructorCutMinor: 0,
				},
			}),
		);
		expect(r.outcome).toBe("finished_on_time");
	});

	it("gives a platform-owned sale no upside", () => {
		const r = calculateSaleLedger(sale({ isPlatformOwned: true }));
		expect(r.atStakeMinor).toBe(0);
	});
});

describe("summariseLedger (§8.5)", () => {
	it("counts on-time finishers and keeps at-stake out of earnings", () => {
		const onTime = calculateSaleLedger(
			sale({
				orderStatus: "earn_back_issued",
				resolution: {
					daysLate: 0,
					forfeitedAmountMinor: 0,
					forfeitedInstructorCutMinor: 0,
				},
			}),
		);
		const late = calculateSaleLedger(
			sale({
				orderStatus: "earn_back_issued",
				resolution: {
					daysLate: 10,
					forfeitedAmountMinor: 1_900,
					forfeitedInstructorCutMinor: 1_710,
				},
			}),
		);
		const open = calculateSaleLedger(sale());

		const s = summariseLedger([
			{ grossMinor: 10_000, result: onTime },
			{ grossMinor: 10_000, result: late },
			{ grossMinor: 10_000, result: open },
		]);

		expect(s.salesCount).toBe(3);
		expect(s.grossMinor).toBe(30_000);
		expect(s.earnedMinor).toBe(1_710); // only the late one paid anything
		expect(s.atStakeMinor).toBe(8_550); // only the open one is still riding
		expect(s.finishedOnTimeCount).toBe(1);
	});

	it("summarises an empty ledger to zeroes, not NaN", () => {
		expect(summariseLedger([])).toEqual({
			salesCount: 0,
			grossMinor: 0,
			earnedMinor: 0,
			atStakeMinor: 0,
			finishedOnTimeCount: 0,
		});
	});
});
