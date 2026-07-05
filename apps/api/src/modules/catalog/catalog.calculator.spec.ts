import { describe, expect, it } from "vitest";
import { FEATURED_CAP, rotateWindow, topByScore } from "./catalog.calculator";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe("rotateWindow", () => {
	it("shows everything when the pool already fits the cap", () => {
		const pool = [1, 2, 3];
		expect(rotateWindow(pool, 8)).toEqual(pool);
	});

	it("shows exactly `cap` items when the pool is larger", () => {
		const pool = Array.from({ length: 20 }, (_, i) => i);
		const result = rotateWindow(pool, 5, 0);
		expect(result).toHaveLength(5);
	});

	it("advances the window by `cap` on the next calendar week", () => {
		const pool = Array.from({ length: 20 }, (_, i) => i);
		const week0 = rotateWindow(pool, 5, 0);
		const week1 = rotateWindow(pool, 5, WEEK_MS);
		expect(week0).toEqual([0, 1, 2, 3, 4]);
		expect(week1).toEqual([5, 6, 7, 8, 9]);
	});

	it("wraps back to the start once the window exceeds the pool", () => {
		const pool = Array.from({ length: 12 }, (_, i) => i);
		// week 2 * cap(5) = 10, so the window [10,11,0,1,2] wraps around
		const result = rotateWindow(pool, 5, 2 * WEEK_MS);
		expect(result).toEqual([10, 11, 0, 1, 2]);
	});

	it("defaults the cap to FEATURED_CAP", () => {
		const pool = Array.from({ length: 20 }, (_, i) => i);
		expect(rotateWindow(pool, undefined, 0)).toHaveLength(FEATURED_CAP);
	});
});

describe("topByScore", () => {
	it("ranks by co-enrolment (weighted x3) plus content match", () => {
		const candidates = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const result = topByScore(candidates, (item) => {
			if (item.id === "a") return { co: 1, content: 0 }; // 3
			if (item.id === "b") return { co: 0, content: 2 }; // 2
			return { co: 0, content: 0 }; // 0
		});
		expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
	});

	it("preserves incoming order for equal scores (stable sort fallback)", () => {
		const candidates = [{ id: "a" }, { id: "b" }, { id: "c" }];
		const result = topByScore(candidates, () => ({ co: 0, content: 0 }));
		expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
	});

	it("keeps only the top `cap` items", () => {
		const candidates = Array.from({ length: 10 }, (_, i) => ({
			id: String(i),
		}));
		const result = topByScore(candidates, () => ({ co: 0, content: 0 }), 3);
		expect(result).toHaveLength(3);
	});
});
