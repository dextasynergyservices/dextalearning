import { describe, expect, it } from "vitest";
import { nextBadgeOf } from "./badge.definitions";
import { type BadgeContext, earnedBadges } from "./badges.calculator";

function ctx(overrides: Partial<BadgeContext> = {}): BadgeContext {
	return {
		lessonsCompleted: 0,
		coursesCompleted: 0,
		quizzesPassed: 0,
		perfectQuiz: false,
		growthLeap: false,
		streakCurrent: 0,
		freezeConsumed: false,
		projectsPassed: 0,
		...overrides,
	};
}

describe("earnedBadges", () => {
	it("awards nothing on an empty context", () => {
		expect(earnedBadges(ctx())).toEqual([]);
	});

	it("lesson thresholds are exact (9 → no, 10/25/50 → yes)", () => {
		expect(earnedBadges(ctx({ lessonsCompleted: 9 }))).toEqual([
			"first_lesson",
		]);
		expect(earnedBadges(ctx({ lessonsCompleted: 10 }))).toEqual([
			"first_lesson",
			"lessons_10",
		]);
		expect(earnedBadges(ctx({ lessonsCompleted: 25 }))).toEqual([
			"first_lesson",
			"lessons_10",
			"lessons_25",
		]);
		expect(earnedBadges(ctx({ lessonsCompleted: 50 }))).toEqual([
			"first_lesson",
			"lessons_10",
			"lessons_25",
			"lessons_50",
		]);
	});

	it("course completions award first_course then courses_3", () => {
		expect(earnedBadges(ctx({ coursesCompleted: 1 }))).toEqual([
			"first_course",
		]);
		expect(earnedBadges(ctx({ coursesCompleted: 3 }))).toEqual([
			"first_course",
			"courses_3",
		]);
	});

	it("quiz badges: first pass, ten distinct passes, perfect score, growth leap", () => {
		expect(earnedBadges(ctx({ quizzesPassed: 1 }))).toEqual([
			"first_quiz_pass",
		]);
		expect(earnedBadges(ctx({ quizzesPassed: 10 }))).toEqual([
			"first_quiz_pass",
			"quizzes_10",
		]);
		expect(earnedBadges(ctx({ perfectQuiz: true }))).toEqual(["perfect_quiz"]);
		expect(earnedBadges(ctx({ growthLeap: true }))).toEqual(["growth_leap"]);
	});

	it("streak milestones are cumulative thresholds (3/7/14/30)", () => {
		expect(earnedBadges(ctx({ streakCurrent: 2 }))).toEqual([]);
		expect(earnedBadges(ctx({ streakCurrent: 3 }))).toEqual(["streak_3"]);
		expect(earnedBadges(ctx({ streakCurrent: 14 }))).toEqual([
			"streak_3",
			"streak_7",
			"streak_14",
		]);
		expect(earnedBadges(ctx({ streakCurrent: 30 }))).toEqual([
			"streak_3",
			"streak_7",
			"streak_14",
			"streak_30",
		]);
	});

	it("surviving a missed day via a freeze awards comeback (§3.2)", () => {
		expect(earnedBadges(ctx({ freezeConsumed: true }))).toEqual(["comeback"]);
	});

	it("project pass awards first_project_pass", () => {
		expect(earnedBadges(ctx({ projectsPassed: 1 }))).toEqual([
			"first_project_pass",
		]);
	});

	it("a rich context earns everything it satisfies at once", () => {
		const all = earnedBadges(
			ctx({
				lessonsCompleted: 50,
				coursesCompleted: 3,
				quizzesPassed: 10,
				perfectQuiz: true,
				growthLeap: true,
				streakCurrent: 30,
				freezeConsumed: true,
				projectsPassed: 2,
			}),
		);
		expect(all).toHaveLength(16);
	});
});

describe("nextBadgeOf (§3.2 goal gradient)", () => {
	const counts = (over: Partial<Record<string, number>> = {}) => ({
		lessons: 0,
		courses: 0,
		quizzes: 0,
		streak: 0,
		...over,
	});

	it("points a fresh learner at the very first rung", () => {
		expect(nextBadgeOf(new Set(), counts())).toEqual({
			key: "first_lesson",
			current: 0,
			target: 1,
		});
	});

	it("picks the badge with the smallest remaining distance", () => {
		// 8 lessons (2 to lessons_10) vs streak 1 (2 to streak_3): tie —
		// smaller target wins (streak_3).
		const earned = new Set(["first_lesson", "first_course", "first_quiz_pass"]);
		expect(nextBadgeOf(earned, counts({ lessons: 8, streak: 1 }))).toEqual({
			key: "streak_3",
			current: 1,
			target: 3,
		});
		// Streak 0: lessons_10 is now strictly closer.
		expect(nextBadgeOf(earned, counts({ lessons: 8 }))).toEqual({
			key: "lessons_10",
			current: 8,
			target: 10,
		});
	});

	it("skips earned badges and picks the closest remaining rung", () => {
		const earned = new Set([
			"first_lesson",
			"lessons_10",
			"first_course",
			"first_quiz_pass",
		]);
		// 12 lessons: lessons_25 is 13 away, but a 2-day streak is 1 away.
		expect(nextBadgeOf(earned, counts({ lessons: 12, streak: 2 }))).toEqual({
			key: "streak_3",
			current: 2,
			target: 3,
		});
	});

	it("returns null when every countable badge is earned", () => {
		const earned = new Set([
			"first_lesson",
			"lessons_10",
			"lessons_25",
			"lessons_50",
			"first_course",
			"courses_3",
			"first_quiz_pass",
			"quizzes_10",
			"streak_3",
			"streak_7",
			"streak_14",
			"streak_30",
		]);
		expect(
			nextBadgeOf(earned, counts({ lessons: 60, courses: 5, quizzes: 12 })),
		).toBeNull();
	});
});
