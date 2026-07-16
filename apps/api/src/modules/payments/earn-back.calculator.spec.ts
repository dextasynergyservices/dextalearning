import { describe, expect, it } from "vitest";
import { calculateEarnBack, daysLate } from "./earn-back.calculator";

describe("calculateEarnBack", () => {
	it("on time (D=0) ⇒ full base refunded, nothing forfeited", () => {
		const r = calculateEarnBack({
			earnBackBaseMinor: 10_000,
			daysLate: 0,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.earnBackAmountMinor).toBe(10_000);
		expect(r.forfeitedAmountMinor).toBe(0);
		expect(r.forfeitedInstructorCutMinor).toBe(0);
		expect(r.forfeitedPlatformCutMinor).toBe(0);
		expect(r.isNoPayout).toBe(false);
	});

	it("finishing early clamps D to 0 (still a full refund)", () => {
		const r = calculateEarnBack({
			earnBackBaseMinor: 10_000,
			daysLate: -5,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.daysLate).toBe(0);
		expect(r.earnBackAmountMinor).toBe(10_000);
	});

	it("10 days late ⇒ 20% forfeited, 80% refunded, forfeit split 90/10", () => {
		const r = calculateEarnBack({
			earnBackBaseMinor: 10_000,
			daysLate: 10,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.forfeitedAmountMinor).toBe(2_000); // 0.02×10×10000
		expect(r.earnBackAmountMinor).toBe(8_000);
		expect(r.forfeitedInstructorCutMinor).toBe(1_800);
		expect(r.forfeitedPlatformCutMinor).toBe(200);
		expect(r.isNoPayout).toBe(false);
	});

	it("50+ days late ⇒ whole base forfeited, no_payout, refund 0", () => {
		const r = calculateEarnBack({
			earnBackBaseMinor: 10_000,
			daysLate: 80,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.daysLate).toBe(50); // capped
		expect(r.forfeitedAmountMinor).toBe(10_000);
		expect(r.earnBackAmountMinor).toBe(0);
		expect(r.forfeitedInstructorCutMinor).toBe(9_000);
		expect(r.forfeitedPlatformCutMinor).toBe(1_000);
		expect(r.isNoPayout).toBe(true);
	});

	it("zero base (earn-back off) ⇒ no_payout with all zeros", () => {
		const r = calculateEarnBack({
			earnBackBaseMinor: 0,
			daysLate: 3,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.earnBackAmountMinor).toBe(0);
		expect(r.forfeitedAmountMinor).toBe(0);
		expect(r.isNoPayout).toBe(true);
	});

	it("refund + forfeited always re-sum to the base (odd base, odd D)", () => {
		const r = calculateEarnBack({
			earnBackBaseMinor: 3_333,
			daysLate: 7,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.earnBackAmountMinor + r.forfeitedAmountMinor).toBe(3_333);
		// forfeited = round(3333 × 14 / 100) = round(466.62) = 467
		expect(r.forfeitedAmountMinor).toBe(467);
		expect(r.earnBackAmountMinor).toBe(2_866);
	});

	it("platform-owned ⇒ forfeited revenue is 100% platform", () => {
		const r = calculateEarnBack({
			earnBackBaseMinor: 10_000,
			daysLate: 10,
			instructorSharePct: 90,
			isPlatformOwned: true,
		});
		expect(r.forfeitedInstructorCutMinor).toBe(0);
		expect(r.forfeitedPlatformCutMinor).toBe(2_000);
	});
});

describe("daysLate", () => {
	const deadline = new Date("2026-03-01T12:00:00Z");

	it("is 0 when finished before the deadline", () => {
		expect(daysLate(deadline, new Date("2026-02-27T12:00:00Z"))).toBe(0);
	});

	it("is 0 when finished a few hours after (partial day rounds down)", () => {
		expect(daysLate(deadline, new Date("2026-03-01T20:00:00Z"))).toBe(0);
	});

	it("counts whole days only", () => {
		expect(daysLate(deadline, new Date("2026-03-04T13:00:00Z"))).toBe(3);
	});
});
