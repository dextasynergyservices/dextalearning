/**
 * Pure catalogue ranking math (§6.4 "pure calculators" — no Prisma, no I/O).
 * Extracted from catalog.service.ts: the Featured weekly-rotation window and
 * the Recommended hybrid-recommender scoring, both deterministic given their
 * inputs (rotation takes "now" as a parameter rather than reading the clock
 * itself, so it stays testable).
 */

/** Homepage Featured: at most this many per shelf, rotated weekly. */
export const FEATURED_CAP = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Deterministic weekly rotation: show at most `cap` items, advancing the
 * visible window by `cap` each calendar week (wrapping). No cron / no extra
 * state — every approved item gets homepage time over the weeks. If the pool
 * already fits the cap, show everything.
 */
export function rotateWindow<T>(
	pool: T[],
	cap = FEATURED_CAP,
	nowMs = Date.now(),
): T[] {
	if (pool.length <= cap) return pool;
	const week = Math.floor(nowMs / WEEK_MS);
	const start = (week * cap) % pool.length;
	return Array.from({ length: cap }, (_, i) => pool[(start + i) % pool.length]);
}

export interface ScoreSignal {
	co: number;
	content: number;
}

/**
 * Rank a popularity-ordered candidate pool by `co`-enrolment (weighted ×3)
 * plus a `content` match bonus, keeping the top `cap`. The sort is stable, so
 * equal scores (e.g. a cold-start learner with no signal) preserve the
 * incoming popularity order — that's the graceful fallback.
 */
export function topByScore<T extends { id: string }>(
	candidates: T[],
	signal: (item: T) => ScoreSignal,
	cap = FEATURED_CAP,
): T[] {
	return candidates
		.map((item) => {
			const { co, content } = signal(item);
			return { item, score: co * 3 + content };
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, cap)
		.map(({ item }) => item);
}
