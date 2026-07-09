/**
 * The badge catalogue (§3.2 "micro-wins are frequent" + "no badge deserts").
 * Keys are the stable contract — names/descriptions live client-side in the
 * `engagement` i18n namespace (`badges.<key>.name` / `.desc`), so copy is
 * never stored. Ladder order matters: it's the display order in the grid.
 */
export const BADGE_KEYS = [
	"first_lesson",
	"lessons_10",
	"lessons_25",
	"lessons_50",
	"first_course",
	"courses_3",
	"first_quiz_pass",
	"quizzes_10",
	"perfect_quiz",
	"growth_leap",
	"streak_3",
	"streak_7",
	"streak_14",
	"streak_30",
	"comeback",
	"first_project_pass",
] as const;

export type BadgeKey = (typeof BADGE_KEYS)[number];

/**
 * Countable-progress badges for the §3.2 goal-gradient nudge ("N more
 * lessons to unlock X"). Event-triggered badges (perfect_quiz, growth_leap,
 * comeback, first_project_pass) are deliberately absent — there's no
 * meaningful "progress toward" a moment-in-time trigger.
 */
export type BadgeMetric = "lessons" | "courses" | "quizzes" | "streak";

export const BADGE_TARGETS: Partial<
	Record<BadgeKey, { metric: BadgeMetric; target: number }>
> = {
	first_lesson: { metric: "lessons", target: 1 },
	lessons_10: { metric: "lessons", target: 10 },
	lessons_25: { metric: "lessons", target: 25 },
	lessons_50: { metric: "lessons", target: 50 },
	first_course: { metric: "courses", target: 1 },
	courses_3: { metric: "courses", target: 3 },
	first_quiz_pass: { metric: "quizzes", target: 1 },
	quizzes_10: { metric: "quizzes", target: 10 },
	streak_3: { metric: "streak", target: 3 },
	streak_7: { metric: "streak", target: 7 },
	streak_14: { metric: "streak", target: 14 },
	streak_30: { metric: "streak", target: 30 },
};

/**
 * Pure pick of the nearest locked countable badge (§3.2 goal gradient):
 * smallest remaining distance wins; ties go to the smaller target (the
 * earlier rung of the ladder). Returns null when everything is earned.
 */
export function nextBadgeOf(
	earnedKeys: ReadonlySet<string>,
	counts: Record<BadgeMetric, number>,
): { key: BadgeKey; current: number; target: number } | null {
	let best: { key: BadgeKey; current: number; target: number } | null = null;
	for (const key of BADGE_KEYS) {
		const spec = BADGE_TARGETS[key];
		if (!spec || earnedKeys.has(key)) continue;
		const current = Math.min(counts[spec.metric], spec.target);
		const remaining = spec.target - current;
		if (remaining <= 0) continue; // earned-but-unrecorded; skip, award catches up
		if (
			!best ||
			remaining < best.target - best.current ||
			(remaining === best.target - best.current && spec.target < best.target)
		) {
			best = { key, current, target: spec.target };
		}
	}
	return best;
}
