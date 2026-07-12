import { describe, expect, it } from "vitest";
import { computeRisk } from "./dropoff.calculator";

describe("computeRisk", () => {
	const base = {
		daysSinceActive: 0,
		daysSinceEnrolled: 30,
		isComplete: false,
		recentActions: 5,
	};

	it("never flags a completed learner", () => {
		const r = computeRisk({ ...base, daysSinceActive: 40, isComplete: true });
		expect(r.level).toBe("low");
		expect(r.reasons).toEqual([]);
	});

	it("flags 14+ days inactive as high", () => {
		const r = computeRisk({ ...base, daysSinceActive: 20, recentActions: 0 });
		expect(r.level).toBe("high");
		expect(r.reasons).toContain("inactive_14d");
		expect(r.daysInactive).toBe(20);
	});

	it("flags 7–13 days inactive as medium", () => {
		const r = computeRisk({ ...base, daysSinceActive: 9, recentActions: 0 });
		expect(r.level).toBe("medium");
		expect(r.reasons).toContain("inactive_7d");
	});

	it("keeps a recently-active learner low", () => {
		expect(computeRisk({ ...base, daysSinceActive: 1 }).level).toBe("low");
	});

	it("flags an enrolled-but-never-started learner past the grace window", () => {
		const high = computeRisk({
			...base,
			daysSinceActive: null,
			daysSinceEnrolled: 8,
		});
		expect(high.level).toBe("high");
		expect(high.reasons).toContain("never_started");
		expect(high.daysInactive).toBe(8);

		const medium = computeRisk({
			...base,
			daysSinceActive: null,
			daysSinceEnrolled: 4,
		});
		expect(medium.level).toBe("medium");
		expect(medium.reasons).toContain("never_started");
	});

	it("gives a brand-new enrollment a grace period", () => {
		const r = computeRisk({
			...base,
			daysSinceActive: null,
			daysSinceEnrolled: 1,
		});
		expect(r.level).toBe("low");
		expect(r.reasons).toEqual([]);
	});

	it("nudges a stalled-but-not-yet-inactive learner to medium", () => {
		const r = computeRisk({ ...base, daysSinceActive: 5, recentActions: 0 });
		expect(r.level).toBe("medium");
		expect(r.reasons).toContain("no_recent_progress");
	});

	it("sorts higher risk / longer idle first via score", () => {
		const high = computeRisk({
			...base,
			daysSinceActive: 30,
			recentActions: 0,
		});
		const medium = computeRisk({
			...base,
			daysSinceActive: 9,
			recentActions: 0,
		});
		const low = computeRisk({ ...base, daysSinceActive: 1 });
		expect(high.score).toBeGreaterThan(medium.score);
		expect(medium.score).toBeGreaterThan(low.score);
	});
});
