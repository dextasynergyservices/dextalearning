import { describe, expect, it } from "vitest";
import { normalizeCommercials } from "./commercials.calculator";

describe("normalizeCommercials", () => {
	it("clears price and Earn-Back fields when marked free", () => {
		const result = normalizeCommercials({
			isFree: true,
			price: 5000,
			isEarnBackEligible: true,
			earnBackPercentage: 80,
		});
		expect(result).toEqual({
			isFree: true,
			price: 0,
			isEarnBackEligible: false,
			earnBackPercentage: null,
		});
	});

	it("ignores currency/deadline updates when marked free (still normalized, but commercials cleared)", () => {
		const result = normalizeCommercials({
			isFree: true,
			currency: "NGN",
			earnBackDeadlineDays: 30,
		});
		// currency/deadline are set before the free short-circuit, so they pass through
		expect(result.currency).toBe("NGN");
		expect(result.earnBackDeadlineDays).toBe(30);
		expect(result.isFree).toBe(true);
		expect(result.price).toBe(0);
	});

	it("defaults Earn-Back percentage to 100 when enabled without an explicit value", () => {
		const result = normalizeCommercials({
			price: 10000,
			isEarnBackEligible: true,
		});
		expect(result.isEarnBackEligible).toBe(true);
		expect(result.earnBackPercentage).toBe(100);
	});

	it("respects an explicit percentage when enabling Earn-Back", () => {
		const result = normalizeCommercials({
			price: 10000,
			isEarnBackEligible: true,
			earnBackPercentage: 65,
		});
		expect(result.earnBackPercentage).toBe(65);
	});

	it("clears the percentage when Earn-Back is disabled", () => {
		const result = normalizeCommercials({
			isEarnBackEligible: false,
		});
		expect(result.isEarnBackEligible).toBe(false);
		expect(result.earnBackPercentage).toBeNull();
	});

	it("updates the percentage alone without touching eligibility, when eligibility isn't sent", () => {
		const result = normalizeCommercials({
			earnBackPercentage: 40,
		});
		expect(result).toEqual({ earnBackPercentage: 40 });
	});

	it("only writes fields the caller actually supplied (partial update)", () => {
		const result = normalizeCommercials({ price: 7500 });
		expect(result).toEqual({ price: 7500 });
	});

	it("passes through currency and earnBackDeadlineDays independently of pricing", () => {
		const result = normalizeCommercials({
			currency: "USD",
			earnBackDeadlineDays: 14,
		});
		expect(result).toEqual({ currency: "USD", earnBackDeadlineDays: 14 });
	});

	it("omits earnBackDeadlineDays entirely when not supplied (cohort use case)", () => {
		const result = normalizeCommercials({
			price: 5000,
			isFree: false,
		});
		expect("earnBackDeadlineDays" in result).toBe(false);
	});
});
