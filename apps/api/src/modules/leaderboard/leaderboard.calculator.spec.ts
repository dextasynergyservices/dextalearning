import { describe, expect, it } from "vitest";
import {
	assignRanks,
	computeImprovement,
	consistencyScore,
	improvedScore,
	overallScore,
	POINTS,
	peerScore,
	scoreFor,
	type UserSignals,
} from "./leaderboard.calculator";

function signals(overrides: Partial<UserSignals> = {}): UserSignals {
	return {
		userId: "u1",
		lessonsCompleted: 0,
		entitiesCompleted: 0,
		quizzesPassed: 0,
		perfectQuizzes: 0,
		projectsPassed: 0,
		longestStreak: 0,
		activeDays: 0,
		improvement: 0,
		peerReviews: 0,
		...overrides,
	};
}

describe("overallScore", () => {
	it("sums achievements by their point weights", () => {
		const s = signals({
			lessonsCompleted: 3, // 30
			entitiesCompleted: 1, // 50
			quizzesPassed: 2, // 40
			perfectQuizzes: 1, // 10
			projectsPassed: 1, // 40
		});
		expect(overallScore(s)).toBe(30 + 50 + 40 + 10 + 40);
	});

	it("is zero for a learner with no achievements", () => {
		expect(overallScore(signals())).toBe(0);
	});
});

describe("consistencyScore", () => {
	it("rewards the longest streak and distinct active days", () => {
		const s = signals({ longestStreak: 7, activeDays: 10 });
		expect(consistencyScore(s)).toBe(
			7 * POINTS.streakDay + 10 * POINTS.activeDay,
		);
	});
});

describe("peerScore", () => {
	it("counts peer reviews", () => {
		expect(peerScore(signals({ peerReviews: 4 }))).toBe(4 * POINTS.peerReview);
	});
});

describe("improvedScore", () => {
	it("is the rounded improvement, never negative", () => {
		expect(improvedScore(signals({ improvement: 42.4 }))).toBe(42);
		expect(improvedScore(signals({ improvement: -5 }))).toBe(0);
	});
});

describe("scoreFor", () => {
	it("dispatches each per-user type to its scorer", () => {
		const s = signals({
			lessonsCompleted: 1,
			longestStreak: 2,
			activeDays: 3,
			improvement: 9,
			peerReviews: 1,
		});
		expect(scoreFor("overall", s)).toBe(overallScore(s));
		expect(scoreFor("consistency", s)).toBe(consistencyScore(s));
		expect(scoreFor("improved", s)).toBe(improvedScore(s));
		expect(scoreFor("peer", s)).toBe(peerScore(s));
		// group falls back to the overall score (used per-member before averaging).
		expect(scoreFor("group", s)).toBe(overallScore(s));
	});
});

describe("computeImprovement", () => {
	it("sums positive pre→post deltas per lesson, needing both a pre and a post", () => {
		const improvement = computeImprovement([
			{ lessonId: "l1", scope: "lesson_pre", score: 40 },
			{ lessonId: "l1", scope: "lesson_post", score: 90 }, // +50
			{ lessonId: "l2", scope: "lesson_pre", score: 70 },
			{ lessonId: "l2", scope: "lesson_post", score: 60 }, // negative → 0
			{ lessonId: "l3", scope: "lesson_post", score: 100 }, // no pre → ignored
		]);
		expect(improvement).toBe(50);
	});

	it("uses the FIRST pre as baseline and the BEST post as achievement", () => {
		const improvement = computeImprovement([
			{ lessonId: "l1", scope: "lesson_pre", score: 30 }, // baseline
			{ lessonId: "l1", scope: "lesson_pre", score: 80 }, // ignored (later pre)
			{ lessonId: "l1", scope: "lesson_post", score: 60 },
			{ lessonId: "l1", scope: "lesson_post", score: 85 }, // best
		]);
		expect(improvement).toBe(85 - 30);
	});
});

describe("assignRanks", () => {
	it("sorts by score desc with competition ranking (1,2,2,4)", () => {
		const ranked = assignRanks([
			{ userId: "a", score: 100 },
			{ userId: "b", score: 80 },
			{ userId: "c", score: 80 },
			{ userId: "d", score: 50 },
		]);
		expect(ranked.map((r) => [r.userId, r.rank])).toEqual([
			["a", 1],
			["b", 2],
			["c", 2],
			["d", 4],
		]);
	});
});
