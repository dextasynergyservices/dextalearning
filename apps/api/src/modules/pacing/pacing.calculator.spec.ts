import { describe, expect, it } from "vitest";
import { computePacing } from "./pacing.calculator";

describe("computePacing", () => {
	const base = {
		lessonsThisWeek: 4,
		targetPerWeek: 7,
		quizzesPassed: 3,
		quizzesTotal: 3,
	};

	it("flags rushing when busy but retention is low", () => {
		const r = computePacing({
			...base,
			lessonsThisWeek: 8,
			quizzesPassed: 1,
			quizzesTotal: 4,
		});
		expect(r.state).toBe("rushing");
	});

	it("does not flag rushing on too few quizzes", () => {
		const r = computePacing({
			...base,
			lessonsThisWeek: 8,
			quizzesPassed: 0,
			quizzesTotal: 1,
		});
		expect(r.state).not.toBe("rushing");
	});

	it("is ahead when the weekly goal is met with good accuracy", () => {
		const r = computePacing({ ...base, lessonsThisWeek: 7 });
		expect(r.state).toBe("ahead");
	});

	it("is behind when well under half the goal", () => {
		const r = computePacing({ ...base, lessonsThisWeek: 2, targetPerWeek: 7 });
		expect(r.state).toBe("behind");
	});

	it("is on_track between half and the full goal", () => {
		const r = computePacing({ ...base, lessonsThisWeek: 4, targetPerWeek: 7 });
		expect(r.state).toBe("on_track");
	});

	it("celebrates a strong week when no goal is set", () => {
		const r = computePacing({
			...base,
			targetPerWeek: null,
			lessonsThisWeek: 6,
		});
		expect(r.state).toBe("ahead");
	});

	it("is steady with no goal and a light week", () => {
		const r = computePacing({
			...base,
			targetPerWeek: null,
			lessonsThisWeek: 2,
		});
		expect(r.state).toBe("on_track");
	});

	it("carries the raw numbers through for display", () => {
		const r = computePacing({ ...base, lessonsThisWeek: 5, targetPerWeek: 7 });
		expect(r.lessonsThisWeek).toBe(5);
		expect(r.targetPerWeek).toBe(7);
	});
});
