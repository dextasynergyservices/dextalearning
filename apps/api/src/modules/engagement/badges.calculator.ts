import type { BadgeKey } from "./badge.definitions";

/**
 * Pure badge rules (§6.4 pure calculators). The events handler assembles a
 * `BadgeContext` snapshot from Engagement-OWNED data only (progress_events +
 * user_streaks) and this function returns every key the snapshot satisfies —
 * persistence dedupes with `createMany({ skipDuplicates: true })`, so rules
 * here stay stateless and re-evaluation is harmless.
 */
export interface BadgeContext {
	/** Distinct lessons with a `completed` progress event. */
	lessonsCompleted: number;
	/** Distinct courses with a `completed` progress event. */
	coursesCompleted: number;
	/** Submitted assessment attempts that passed. */
	quizzesPassed: number;
	/** The triggering event was a quiz pass with a 100% score. */
	perfectQuiz: boolean;
	/** Post-lesson score beat the same lesson's pre-quiz score by ≥ this. */
	growthLeap: boolean;
	/** Streak length after the triggering activity. */
	streakCurrent: number;
	/** The triggering activity consumed a freeze — streak survived a miss. */
	freezeConsumed: boolean;
	/** Graded project submissions that passed. */
	projectsPassed: number;
}

/** Post-quiz must beat the pre-quiz score by at least this many points. */
export const GROWTH_LEAP_MIN_DELTA = 25;

export function earnedBadges(ctx: BadgeContext): BadgeKey[] {
	const earned: BadgeKey[] = [];
	if (ctx.lessonsCompleted >= 1) earned.push("first_lesson");
	if (ctx.lessonsCompleted >= 10) earned.push("lessons_10");
	if (ctx.lessonsCompleted >= 25) earned.push("lessons_25");
	if (ctx.lessonsCompleted >= 50) earned.push("lessons_50");
	if (ctx.coursesCompleted >= 1) earned.push("first_course");
	if (ctx.coursesCompleted >= 3) earned.push("courses_3");
	if (ctx.quizzesPassed >= 1) earned.push("first_quiz_pass");
	if (ctx.quizzesPassed >= 10) earned.push("quizzes_10");
	if (ctx.perfectQuiz) earned.push("perfect_quiz");
	if (ctx.growthLeap) earned.push("growth_leap");
	if (ctx.streakCurrent >= 3) earned.push("streak_3");
	if (ctx.streakCurrent >= 7) earned.push("streak_7");
	if (ctx.streakCurrent >= 14) earned.push("streak_14");
	if (ctx.streakCurrent >= 30) earned.push("streak_30");
	if (ctx.freezeConsumed) earned.push("comeback");
	if (ctx.projectsPassed >= 1) earned.push("first_project_pass");
	return earned;
}
