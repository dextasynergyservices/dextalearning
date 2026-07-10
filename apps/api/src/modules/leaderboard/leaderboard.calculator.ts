/**
 * Pure leaderboard scoring (§4.9; §6.4 rule 4 — no Prisma, no NestJS, no I/O).
 * One source of truth for how raw engagement signals become points, and how
 * points become ranks. The service does the I/O (aggregating signals, caching);
 * every scoring rule and the ranking live here, exhaustively unit-tested.
 */

export type LeaderboardType =
	| "overall"
	| "consistency"
	| "improved"
	| "group"
	| "peer";

export const LEADERBOARD_TYPES: LeaderboardType[] = [
	"overall",
	"consistency",
	"improved",
	"group",
	"peer",
];

/** Points per achievement — the whole scoring model in one place. */
export const POINTS = {
	lessonCompleted: 10,
	entityCompleted: 50,
	quizPassed: 20,
	perfectQuizBonus: 10,
	projectPassed: 40,
	peerReview: 15,
	/** Consistency: per day of the learner's longest streak. */
	streakDay: 5,
	/** Consistency: per distinct day the learner was active. */
	activeDay: 4,
} as const;

/** Per-user aggregates the calculator turns into scores. */
export interface UserSignals {
	userId: string;
	lessonsCompleted: number;
	entitiesCompleted: number;
	quizzesPassed: number;
	perfectQuizzes: number;
	projectsPassed: number;
	longestStreak: number;
	activeDays: number;
	/** Sum of positive pre→post quiz deltas (see `computeImprovement`). */
	improvement: number;
	peerReviews: number;
}

export function overallScore(s: UserSignals): number {
	return (
		s.lessonsCompleted * POINTS.lessonCompleted +
		s.entitiesCompleted * POINTS.entityCompleted +
		s.quizzesPassed * POINTS.quizPassed +
		s.perfectQuizzes * POINTS.perfectQuizBonus +
		s.projectsPassed * POINTS.projectPassed
	);
}

export function consistencyScore(s: UserSignals): number {
	return s.longestStreak * POINTS.streakDay + s.activeDays * POINTS.activeDay;
}

export function improvedScore(s: UserSignals): number {
	return Math.max(0, Math.round(s.improvement));
}

export function peerScore(s: UserSignals): number {
	return s.peerReviews * POINTS.peerReview;
}

/** The score for a per-user leaderboard type (not `group`). */
export function scoreFor(type: LeaderboardType, s: UserSignals): number {
	switch (type) {
		case "consistency":
			return consistencyScore(s);
		case "improved":
			return improvedScore(s);
		case "peer":
			return peerScore(s);
		default:
			return overallScore(s);
	}
}

export interface AttemptRecord {
	lessonId: string | null;
	scope: string;
	score: number;
	/** Chronological order is the caller's responsibility (createdAt asc). */
}

/**
 * "Most improved" — sum over lessons of `max(0, bestPost − firstPre)`, counting
 * only lessons the learner took BOTH a pre-lesson and a post-lesson quiz on.
 * `attempts` must be in chronological order so "first pre" is the baseline.
 */
export function computeImprovement(attempts: AttemptRecord[]): number {
	const firstPre = new Map<string, number>();
	const bestPost = new Map<string, number>();
	for (const a of attempts) {
		if (!a.lessonId) continue;
		if (a.scope === "lesson_pre" && !firstPre.has(a.lessonId)) {
			firstPre.set(a.lessonId, a.score);
		} else if (a.scope === "lesson_post") {
			bestPost.set(
				a.lessonId,
				Math.max(bestPost.get(a.lessonId) ?? 0, a.score),
			);
		}
	}
	let total = 0;
	for (const [lessonId, pre] of firstPre) {
		const post = bestPost.get(lessonId);
		if (post != null) total += Math.max(0, post - pre);
	}
	return total;
}

/**
 * Standard competition ranking (1, 2, 2, 4): sort by score desc, ties share a
 * rank and the next rank skips. Stable for equal scores (input order kept).
 */
export function assignRanks<T extends { score: number }>(
	entries: T[],
): (T & { rank: number })[] {
	const sorted = [...entries].sort((a, b) => b.score - a.score);
	let lastScore = Number.POSITIVE_INFINITY;
	let lastRank = 0;
	return sorted.map((entry, index) => {
		const rank = entry.score === lastScore ? lastRank : index + 1;
		lastScore = entry.score;
		lastRank = rank;
		return { ...entry, rank };
	});
}
