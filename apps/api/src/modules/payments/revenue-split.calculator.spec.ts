import { describe, expect, it } from "vitest";
import {
	calculateRevenueSplit,
	splitRevenue,
} from "./revenue-split.calculator";

describe("calculateRevenueSplit", () => {
	it("earn-back OFF ⇒ whole price is guaranteed revenue, split 90/10", () => {
		const r = calculateRevenueSplit({
			priceMinor: 10_000, // ₦100.00
			isEarnBackEligible: false,
			earnBackPercentage: null,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.earnBackBaseMinor).toBe(0);
		expect(r.guaranteedRevenueMinor).toBe(10_000);
		expect(r.instructorAmountMinor).toBe(9_000);
		expect(r.platformAmountMinor).toBe(1_000);
	});

	it("earn-back 100% ⇒ entire price escrowed, nothing settles now", () => {
		const r = calculateRevenueSplit({
			priceMinor: 10_000,
			isEarnBackEligible: true,
			earnBackPercentage: 100,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.earnBackBaseMinor).toBe(10_000);
		expect(r.guaranteedRevenueMinor).toBe(0);
		expect(r.instructorAmountMinor).toBe(0);
		expect(r.platformAmountMinor).toBe(0);
	});

	it("earn-back 50% ⇒ half escrowed, half settles 90/10", () => {
		const r = calculateRevenueSplit({
			priceMinor: 10_000,
			isEarnBackEligible: true,
			earnBackPercentage: 50,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.earnBackBaseMinor).toBe(5_000);
		expect(r.guaranteedRevenueMinor).toBe(5_000);
		expect(r.instructorAmountMinor).toBe(4_500);
		expect(r.platformAmountMinor).toBe(500);
	});

	it("null percentage while eligible defaults to 100% base", () => {
		const r = calculateRevenueSplit({
			priceMinor: 8_000,
			isEarnBackEligible: true,
			earnBackPercentage: null,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.earnBackBaseMinor).toBe(8_000);
		expect(r.guaranteedRevenueMinor).toBe(0);
	});

	it("platform-owned content settles 100% to the platform", () => {
		const r = calculateRevenueSplit({
			priceMinor: 10_000,
			isEarnBackEligible: false,
			earnBackPercentage: null,
			instructorSharePct: 90,
			isPlatformOwned: true,
		});
		expect(r.instructorAmountMinor).toBe(0);
		expect(r.platformAmountMinor).toBe(10_000);
	});

	it("cuts always re-sum to N to the exact minor unit (odd split)", () => {
		// N = 3333 kobo, 90% = 2999.7 → instructor floored to 2999, platform 334.
		const r = calculateRevenueSplit({
			priceMinor: 3_333,
			isEarnBackEligible: false,
			earnBackPercentage: null,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.instructorAmountMinor + r.platformAmountMinor).toBe(
			r.guaranteedRevenueMinor,
		);
		expect(r.instructorAmountMinor).toBe(2_999);
		expect(r.platformAmountMinor).toBe(334);
	});

	it("base rounds DOWN so guaranteed revenue is never inflated (odd base)", () => {
		// 33% of 10001 = 3300.33 → base floored to 3300, N = 6701.
		const r = calculateRevenueSplit({
			priceMinor: 10_001,
			isEarnBackEligible: true,
			earnBackPercentage: 33,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.earnBackBaseMinor).toBe(3_300);
		expect(r.guaranteedRevenueMinor).toBe(6_701);
		expect(r.earnBackBaseMinor + r.guaranteedRevenueMinor).toBe(10_001);
	});

	it("free content (price 0) yields all-zero pools", () => {
		const r = calculateRevenueSplit({
			priceMinor: 0,
			isEarnBackEligible: true,
			earnBackPercentage: 100,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r).toEqual({
			platformFeeMinor: 0,
			earnBackBaseMinor: 0,
			guaranteedRevenueMinor: 0,
			instructorAmountMinor: 0,
			platformAmountMinor: 0,
		});
	});

	it("clamps an out-of-range percentage to [0,100]", () => {
		const over = calculateRevenueSplit({
			priceMinor: 10_000,
			isEarnBackEligible: true,
			earnBackPercentage: 150,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(over.earnBackBaseMinor).toBe(10_000);
	});

	it("omitting platformFeePct behaves as a 0% fee (backwards compatible)", () => {
		const r = calculateRevenueSplit({
			priceMinor: 10_000,
			isEarnBackEligible: false,
			earnBackPercentage: null,
			instructorSharePct: 90,
			isPlatformOwned: false,
		});
		expect(r.platformFeeMinor).toBe(0);
		expect(r.guaranteedRevenueMinor).toBe(10_000);
	});
});

describe("calculateRevenueSplit with platform fee (§2)", () => {
	it("takes the fee off the top; earn-back OFF splits the remainder 90/10", () => {
		// ₦7,500 = 750_000 kobo, 5% fee = 37_500; R = 712_500.
		const r = calculateRevenueSplit({
			priceMinor: 750_000,
			isEarnBackEligible: false,
			earnBackPercentage: null,
			instructorSharePct: 90,
			isPlatformOwned: false,
			platformFeePct: 5,
		});
		expect(r.platformFeeMinor).toBe(37_500);
		expect(r.earnBackBaseMinor).toBe(0);
		expect(r.guaranteedRevenueMinor).toBe(712_500);
		expect(r.instructorAmountMinor).toBe(641_250); // 90% of R
		// platform = fee + 10% of R = 37_500 + 71_250
		expect(r.platformAmountMinor).toBe(108_750);
		// conservation: F + N + B = P
		expect(
			r.platformFeeMinor + r.guaranteedRevenueMinor + r.earnBackBaseMinor,
		).toBe(750_000);
	});

	it("100% earn-back: learner can earn back R (post-fee), never the fee", () => {
		const r = calculateRevenueSplit({
			priceMinor: 750_000,
			isEarnBackEligible: true,
			earnBackPercentage: 100,
			instructorSharePct: 90,
			isPlatformOwned: false,
			platformFeePct: 5,
		});
		expect(r.platformFeeMinor).toBe(37_500);
		expect(r.earnBackBaseMinor).toBe(712_500); // max refundable = R, not P
		expect(r.guaranteedRevenueMinor).toBe(0);
		expect(r.platformAmountMinor).toBe(37_500); // just the fee settles now
	});

	it("50% earn-back with fee: base + N on the remainder", () => {
		const r = calculateRevenueSplit({
			priceMinor: 750_000,
			isEarnBackEligible: true,
			earnBackPercentage: 50,
			instructorSharePct: 90,
			isPlatformOwned: false,
			platformFeePct: 5,
		});
		expect(r.platformFeeMinor).toBe(37_500);
		expect(r.earnBackBaseMinor).toBe(356_250); // 50% of 712_500
		expect(r.guaranteedRevenueMinor).toBe(356_250);
		expect(r.instructorAmountMinor).toBe(320_625); // 90% of N
		expect(r.platformAmountMinor).toBe(37_500 + 35_625);
	});

	it("platform-owned: fee + all of N go to the platform, instructor 0", () => {
		const r = calculateRevenueSplit({
			priceMinor: 750_000,
			isEarnBackEligible: false,
			earnBackPercentage: null,
			instructorSharePct: 90,
			isPlatformOwned: true,
			platformFeePct: 5,
		});
		expect(r.instructorAmountMinor).toBe(0);
		expect(r.platformAmountMinor).toBe(750_000); // fee + all of N (=R)
	});

	it("conserves to the exact minor unit with odd price + fee + earn-back", () => {
		const r = calculateRevenueSplit({
			priceMinor: 99_999,
			isEarnBackEligible: true,
			earnBackPercentage: 33,
			instructorSharePct: 90,
			isPlatformOwned: false,
			platformFeePct: 7,
		});
		expect(
			r.platformFeeMinor + r.guaranteedRevenueMinor + r.earnBackBaseMinor,
		).toBe(99_999);
		expect(r.instructorAmountMinor + r.platformAmountMinor).toBe(
			r.platformFeeMinor + r.guaranteedRevenueMinor,
		);
	});

	it("fee is clamped to [0,100] inside the calculator too", () => {
		const r = calculateRevenueSplit({
			priceMinor: 10_000,
			isEarnBackEligible: false,
			earnBackPercentage: null,
			instructorSharePct: 90,
			isPlatformOwned: false,
			platformFeePct: 150,
		});
		expect(r.platformFeeMinor).toBe(10_000); // clamped to 100%
	});
});

describe("splitRevenue", () => {
	it("returns everything to the platform for zero or negative N", () => {
		expect(splitRevenue(0, 90, false)).toEqual({
			instructorAmountMinor: 0,
			platformAmountMinor: 0,
		});
		expect(splitRevenue(-5, 90, false)).toEqual({
			instructorAmountMinor: 0,
			platformAmountMinor: 0,
		});
	});

	it("honours a non-default share pct and still re-sums", () => {
		const r = splitRevenue(1_000, 70, false);
		expect(r.instructorAmountMinor).toBe(700);
		expect(r.platformAmountMinor).toBe(300);
	});
});
