import { describe, expect, it } from "vitest";
import {
	calculateIntegrity,
	calculateScore,
	DEFAULT_SEVERITY,
	detectFastAnswers,
	isAnswerCorrect,
	isPassed,
	resolveSeverity,
	SEVERITY_WEIGHT,
	shouldAutoSubmit,
} from "./attempts.calculator";

describe("isAnswerCorrect", () => {
	it("is false when there is no question or no answer given", () => {
		expect(isAnswerCorrect(undefined, "a")).toBe(false);
		expect(
			isAnswerCorrect({ type: "mcq", correctAnswer: "a" }, undefined),
		).toBe(false);
	});

	it("is false when the question has no correct answer configured", () => {
		expect(isAnswerCorrect({ type: "mcq", correctAnswer: "" }, "a")).toBe(
			false,
		);
	});

	it("matches short answers case-insensitively", () => {
		expect(
			isAnswerCorrect(
				{ type: "short_answer", correctAnswer: "Paris" },
				"paris",
			),
		).toBe(true);
	});

	it("matches non-short-answer questions exactly (case-sensitive)", () => {
		expect(isAnswerCorrect({ type: "mcq", correctAnswer: "B" }, "b")).toBe(
			false,
		);
		expect(isAnswerCorrect({ type: "mcq", correctAnswer: "B" }, "B")).toBe(
			true,
		);
	});
});

describe("calculateScore", () => {
	it("is 0 when there are no scoreable points", () => {
		const result = calculateScore([]);
		expect(result.score).toBe(0);
	});

	it("computes the percent of points earned, rounded to 2dp", () => {
		const result = calculateScore([
			{ points: 1, correct: true },
			{ points: 1, correct: true },
			{ points: 1, correct: false },
		]);
		expect(result.earned).toBe(2);
		expect(result.total).toBe(3);
		expect(result.score).toBe(66.67);
	});

	it("weighs points, not just question count", () => {
		const result = calculateScore([
			{ points: 5, correct: true },
			{ points: 1, correct: false },
		]);
		expect(result.score).toBe(83.33);
	});
});

describe("isPassed", () => {
	it("passes at or above the pass mark, fails below it", () => {
		expect(isPassed(70, 70)).toBe(true);
		expect(isPassed(69.99, 70)).toBe(false);
	});
});

describe("detectFastAnswers", () => {
	const startedAt = "2026-01-01T00:00:00.000Z";

	it("returns no flags when the threshold is disabled (<= 0)", () => {
		const result = detectFastAnswers({
			thresholdSeconds: 0,
			startedAt,
			answeredAt: { q1: "2026-01-01T00:00:00.500Z" },
		});
		expect(result).toEqual([]);
	});

	it("flags an answer given faster than the threshold after start", () => {
		const result = detectFastAnswers({
			thresholdSeconds: 2,
			startedAt,
			answeredAt: { q1: "2026-01-01T00:00:01.000Z" },
		});
		expect(result).toEqual([{ questionId: "q1", seconds: 1 }]);
	});

	it("does not flag an answer at/after the threshold", () => {
		const result = detectFastAnswers({
			thresholdSeconds: 2,
			startedAt,
			answeredAt: { q1: "2026-01-01T00:00:02.000Z" },
		});
		expect(result).toEqual([]);
	});

	it("measures each gap from the PREVIOUS answer, not always from start", () => {
		const result = detectFastAnswers({
			thresholdSeconds: 2,
			startedAt,
			answeredAt: {
				q1: "2026-01-01T00:00:05.000Z", // 5s from start, not flagged
				q2: "2026-01-01T00:00:06.000Z", // 1s after q1, flagged
			},
		});
		expect(result).toEqual([{ questionId: "q2", seconds: 1 }]);
	});
});

describe("resolveSeverity", () => {
	it("uses the client-reported severity when supplied", () => {
		expect(resolveSeverity("tab_switch", "high")).toBe("high");
	});

	it("falls back to the event's default severity", () => {
		expect(resolveSeverity("fullscreen_exit")).toBe("high");
		expect(resolveSeverity("focus_loss")).toBe("low");
	});

	it("falls back to medium for an unrecognised event type", () => {
		expect(resolveSeverity("something_unknown")).toBe("medium");
	});
});

describe("calculateIntegrity", () => {
	it("is 100 with no flags at all", () => {
		expect(calculateIntegrity([])).toEqual({
			integrityScore: 100,
			flagCount: 0,
		});
	});

	it("subtracts the weighted penalty of every logged flag", () => {
		const result = calculateIntegrity([
			{ severity: "low" }, // 2
			{ severity: "medium" }, // 5
			{ severity: "high" }, // 10
		]);
		expect(result.integrityScore).toBe(100 - 2 - 5 - 10);
		expect(result.flagCount).toBe(3);
	});

	it("floors the score at 0 instead of going negative", () => {
		const logs = Array.from({ length: 20 }, () => ({ severity: "high" }));
		const result = calculateIntegrity(logs);
		expect(result.integrityScore).toBe(0);
		expect(result.flagCount).toBe(20);
	});

	it("matches the exported SEVERITY_WEIGHT map", () => {
		expect(SEVERITY_WEIGHT).toEqual({ low: 2, medium: 5, high: 10 });
	});
});

describe("shouldAutoSubmit", () => {
	it("triggers when tab switches reach the configured limit", () => {
		const result = shouldAutoSubmit({
			tabSwitches: 3,
			tabSwitchLimit: 3,
			fullscreenExits: 0,
			fullscreenRequired: false,
		});
		expect(result).toBe(true);
	});

	it("does not trigger on tab switches below the limit", () => {
		const result = shouldAutoSubmit({
			tabSwitches: 2,
			tabSwitchLimit: 3,
			fullscreenExits: 0,
			fullscreenRequired: false,
		});
		expect(result).toBe(false);
	});

	it("triggers on 2+ fullscreen exits only when fullscreen is required", () => {
		expect(
			shouldAutoSubmit({
				tabSwitches: 0,
				tabSwitchLimit: 99,
				fullscreenExits: 2,
				fullscreenRequired: true,
			}),
		).toBe(true);
		expect(
			shouldAutoSubmit({
				tabSwitches: 0,
				tabSwitchLimit: 99,
				fullscreenExits: 2,
				fullscreenRequired: false,
			}),
		).toBe(false);
	});
});

describe("DEFAULT_SEVERITY", () => {
	it("covers every anti-cheat event type used by the client", () => {
		expect(Object.keys(DEFAULT_SEVERITY).sort()).toEqual(
			[
				"camera_face_missing",
				"camera_multiple_faces",
				"copy_attempt",
				"devtools_open",
				"fast_answer",
				"focus_loss",
				"fullscreen_exit",
				"keyboard_shortcut",
				"paste_attempt",
				"right_click",
				"tab_switch",
				"viewport_change",
			].sort(),
		);
	});
});
