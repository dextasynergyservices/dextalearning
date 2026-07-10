import { apiFetch } from "./api";

// Client for the Leaderboard context (§4.9) — five ranked board types, cached
// server-side, each returning the caller's own position.

export type LeaderboardType =
	| "overall"
	| "consistency"
	| "improved"
	| "group"
	| "peer";

export type LeaderboardPeriod = "all_time" | "weekly";

export interface LeaderboardEntry {
	rank: number;
	score: number;
	subjectId: string;
	name: string;
	isSelf: boolean;
}

export interface Leaderboard {
	type: LeaderboardType;
	period: LeaderboardPeriod;
	cohortId: string | null;
	/** "user" boards rank learners; "group" boards rank a cohort's groups. */
	kind: "user" | "group";
	total: number;
	entries: LeaderboardEntry[];
	me: LeaderboardEntry | null;
}

export function getLeaderboard(params: {
	type: LeaderboardType;
	period: LeaderboardPeriod;
	cohortId?: string;
	limit?: number;
}): Promise<Leaderboard> {
	const query = new URLSearchParams({
		type: params.type,
		period: params.period,
	});
	if (params.cohortId) query.set("cohortId", params.cohortId);
	if (params.limit) query.set("limit", String(params.limit));
	return apiFetch<Leaderboard>(`/leaderboard?${query.toString()}`);
}

export const leaderboardKeys = {
	board: (type: LeaderboardType, period: LeaderboardPeriod) =>
		["leaderboard", type, period] as const,
};
