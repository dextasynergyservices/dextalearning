import { describe, expect, it } from "vitest";
import {
	addDays,
	applyActivity,
	DEFAULT_TIMEZONE,
	dayBefore,
	diffDays,
	isAtRisk,
	localDateOf,
	localHourOf,
	resolveTimezone,
	type StreakState,
} from "./streak.calculator";

function state(overrides: Partial<StreakState> = {}): StreakState {
	return {
		current: 0,
		longest: 0,
		freezes: 0,
		lastActiveDate: null,
		...overrides,
	};
}

describe("localDateOf / timezone handling", () => {
	it("resolves the local calendar day across the UTC boundary", () => {
		// 23:30 UTC on Jan 1 is already Jan 2, 00:30 in Lagos (UTC+1).
		const instant = new Date("2026-01-01T23:30:00.000Z");
		expect(localDateOf(instant, "Africa/Lagos")).toBe("2026-01-02");
		expect(localDateOf(instant, "UTC")).toBe("2026-01-01");
	});

	it("falls back to Africa/Lagos for a missing or invalid timezone", () => {
		expect(resolveTimezone(null)).toBe(DEFAULT_TIMEZONE);
		expect(resolveTimezone("Not/AZone")).toBe(DEFAULT_TIMEZONE);
		expect(resolveTimezone("Europe/Paris")).toBe("Europe/Paris");
		const instant = new Date("2026-01-01T23:30:00.000Z");
		expect(localDateOf(instant, "garbage")).toBe("2026-01-02");
	});

	it("localHourOf reports the user-local hour", () => {
		const instant = new Date("2026-01-01T07:00:00.000Z");
		expect(localHourOf(instant, "Africa/Lagos")).toBe(8); // UTC+1
		expect(localHourOf(instant, "UTC")).toBe(7);
	});
});

describe("date-only arithmetic", () => {
	it("diffDays / dayBefore / addDays are exact across month boundaries", () => {
		expect(diffDays("2026-01-31", "2026-02-01")).toBe(1);
		expect(diffDays("2026-02-01", "2026-01-31")).toBe(-1);
		expect(dayBefore("2026-03-01")).toBe("2026-02-28");
		expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
	});
});

describe("applyActivity", () => {
	it("first-ever activity starts a streak of 1", () => {
		const result = applyActivity(state(), "2026-01-10");
		expect(result).toMatchObject({
			current: 1,
			longest: 1,
			freezes: 0,
			lastActiveDate: "2026-01-10",
			changed: true,
			freezesConsumed: 0,
			milestoneReached: null,
		});
	});

	it("same local day is an idempotent no-op", () => {
		const s = state({ current: 3, longest: 5, lastActiveDate: "2026-01-10" });
		const result = applyActivity(s, "2026-01-10");
		expect(result.changed).toBe(false);
		expect(result.current).toBe(3);
	});

	it("never regresses when today is before lastActiveDate (westward tz travel)", () => {
		const s = state({ current: 3, longest: 3, lastActiveDate: "2026-01-10" });
		const result = applyActivity(s, "2026-01-09");
		expect(result.changed).toBe(false);
		expect(result.current).toBe(3);
		expect(result.lastActiveDate).toBe("2026-01-10");
	});

	it("increments on the consecutive day and tracks longest", () => {
		const s = state({ current: 5, longest: 5, lastActiveDate: "2026-01-10" });
		const result = applyActivity(s, "2026-01-11");
		expect(result.current).toBe(6);
		expect(result.longest).toBe(6);
	});

	it("bridges a single missed day with one freeze", () => {
		const s = state({
			current: 5,
			longest: 8,
			freezes: 1,
			lastActiveDate: "2026-01-10",
		});
		const result = applyActivity(s, "2026-01-12"); // missed the 11th
		expect(result.current).toBe(6);
		expect(result.freezes).toBe(0);
		expect(result.freezesConsumed).toBe(1);
		expect(result.longest).toBe(8);
	});

	it("bridges multiple missed days when enough freezes are banked", () => {
		const s = state({
			current: 9,
			longest: 9,
			freezes: 2,
			lastActiveDate: "2026-01-10",
		});
		const result = applyActivity(s, "2026-01-13"); // missed 11th + 12th
		expect(result.current).toBe(10);
		expect(result.freezes).toBe(0);
		expect(result.freezesConsumed).toBe(2);
	});

	it("resets to 1 when the gap exceeds banked freezes — and RETAINS them", () => {
		const s = state({
			current: 9,
			longest: 9,
			freezes: 1,
			lastActiveDate: "2026-01-10",
		});
		const result = applyActivity(s, "2026-01-13"); // 2 missed, only 1 freeze
		expect(result.current).toBe(1);
		expect(result.freezes).toBe(1); // never spent on a broken streak
		expect(result.freezesConsumed).toBe(0);
		expect(result.longest).toBe(9);
	});

	it("earns a freeze at every 7-day milestone", () => {
		const s = state({ current: 6, longest: 6, lastActiveDate: "2026-01-10" });
		const result = applyActivity(s, "2026-01-11");
		expect(result.current).toBe(7);
		expect(result.freezes).toBe(1);
		expect(result.milestoneReached).toBe(7);
	});

	it("caps banked freezes at 2 (14-day milestone with 2 already banked)", () => {
		const s = state({
			current: 13,
			longest: 13,
			freezes: 2,
			lastActiveDate: "2026-01-10",
		});
		const result = applyActivity(s, "2026-01-11");
		expect(result.current).toBe(14);
		expect(result.freezes).toBe(2);
		expect(result.milestoneReached).toBe(14);
	});

	it("a freeze consumed en route to a milestone is immediately re-earned", () => {
		const s = state({
			current: 6,
			longest: 6,
			freezes: 1,
			lastActiveDate: "2026-01-10",
		});
		const result = applyActivity(s, "2026-01-12"); // bridge 1 day → reach 7
		expect(result.current).toBe(7);
		expect(result.freezesConsumed).toBe(1);
		expect(result.freezes).toBe(1); // 1 − 1 + 1 (milestone)
	});
});

describe("isAtRisk", () => {
	it("is at risk exactly when the last activity was yesterday", () => {
		expect(isAtRisk("2026-01-10", "2026-01-11")).toBe(true);
		expect(isAtRisk("2026-01-11", "2026-01-11")).toBe(false);
		expect(isAtRisk("2026-01-09", "2026-01-11")).toBe(false);
		expect(isAtRisk(null, "2026-01-11")).toBe(false);
	});
});
