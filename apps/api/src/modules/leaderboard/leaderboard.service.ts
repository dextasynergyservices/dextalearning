import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import { CACHE_PORT, type CachePort } from "../../shared/cache/cache.port";
import {
	type AttemptRecord,
	assignRanks,
	computeImprovement,
	type LeaderboardType,
	overallScore,
	scoreFor,
	type UserSignals,
} from "./leaderboard.calculator";

export type LeaderboardPeriod = "all_time" | "weekly";

/** Cached ranked entry (kept lean — display names are looked up per request). */
interface RankedSubject {
	subjectId: string;
	score: number;
	rank: number;
}

const CACHE_TTL_SECONDS = 120;
const WEEK_MS = 7 * 86_400_000;

interface MutableSignals {
	lessonsCompleted: number;
	entitiesCompleted: number;
	quizzesPassed: number;
	perfectQuizzes: number;
	projectsPassed: number;
}

function empty(): MutableSignals {
	return {
		lessonsCompleted: 0,
		entitiesCompleted: 0,
		quizzesPassed: 0,
		perfectQuizzes: 0,
		projectsPassed: 0,
	};
}

/**
 * Leaderboard context (§4.9). A read-model over engagement signals: like the
 * Analytics context it aggregates across tables for reporting, then ranks with
 * the pure calculator and caches the result in Redis (via `CachePort`, TTL
 * 120s) so the hot path is a single cache read. Nothing here is written back to
 * another context's tables.
 */
@Injectable()
export class LeaderboardService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
	) {}

	async getLeaderboard(
		actor: AuthenticatedUser,
		params: {
			type: LeaderboardType;
			cohortId?: string;
			period: LeaderboardPeriod;
			limit: number;
		},
	) {
		const { type, cohortId, period, limit } = params;
		const since = period === "weekly" ? new Date(Date.now() - WEEK_MS) : null;
		const cacheKey = `lb:${type}:${cohortId ?? "global"}:${period}`;

		let full = await this.cache.get<RankedSubject[]>(cacheKey);
		if (!full) {
			full =
				type === "group"
					? await this.computeGroupBoard(cohortId, since)
					: await this.computeUserBoard(type, cohortId, since);
			await this.cache.set(cacheKey, full, CACHE_TTL_SECONDS);
		}
		return this.present(actor, type, cohortId, period, full, limit);
	}

	private async enrolledUserIds(cohortId: string): Promise<string[]> {
		const rows = await this.prisma.cohortEnrollment.findMany({
			where: { cohortId, NOT: { status: "dropped" } },
			select: { userId: true },
		});
		return rows.map((r) => r.userId);
	}

	/** Aggregate every relevant learner's raw signals for the scope/period. */
	private async gatherSignals(
		cohortId: string | undefined,
		since: Date | null,
	): Promise<Map<string, UserSignals>> {
		const enrolledIds = cohortId ? await this.enrolledUserIds(cohortId) : null;
		const userFilter: Prisma.ProgressEventWhereInput["userId"] = enrolledIds
			? { in: enrolledIds }
			: { not: null };

		const events = await this.prisma.progressEvent.findMany({
			where: {
				userId: userFilter,
				...(since ? { createdAt: { gte: since } } : {}),
			},
			orderBy: { createdAt: "asc" },
			select: {
				userId: true,
				eventType: true,
				entityType: true,
				metadataJson: true,
				createdAt: true,
			},
		});

		const base = new Map<string, MutableSignals>();
		const attempts = new Map<string, AttemptRecord[]>();
		const activeDates = new Map<string, Set<string>>();
		const get = (id: string) => {
			let s = base.get(id);
			if (!s) {
				s = empty();
				base.set(id, s);
			}
			return s;
		};

		for (const e of events) {
			const uid = e.userId;
			if (!uid) continue;
			const s = get(uid);
			const meta = (e.metadataJson ?? {}) as Record<string, unknown>;

			if (e.eventType === "completed") {
				if (e.entityType === "lesson") s.lessonsCompleted++;
				else if (
					e.entityType === "course" ||
					e.entityType === "path" ||
					e.entityType === "cohort"
				)
					s.entitiesCompleted++;
			} else if (e.eventType === "attempt_submitted") {
				const passed = meta.passed === true;
				const score = typeof meta.score === "number" ? meta.score : 0;
				if (passed) s.quizzesPassed++;
				if (passed && score === 100) s.perfectQuizzes++;
				const scope = typeof meta.scope === "string" ? meta.scope : "";
				if (scope === "lesson_pre" || scope === "lesson_post") {
					const list = attempts.get(uid) ?? [];
					list.push({
						lessonId: typeof meta.lessonId === "string" ? meta.lessonId : null,
						scope,
						score,
					});
					attempts.set(uid, list);
				}
			} else if (e.eventType === "graded" && meta.passed === true) {
				s.projectsPassed++;
			}

			if (e.eventType === "completed" || e.eventType === "attempt_submitted") {
				const day = e.createdAt.toISOString().slice(0, 10);
				const set = activeDates.get(uid) ?? new Set<string>();
				set.add(day);
				activeDates.set(uid, set);
			}
		}

		// Peer reviews (peer-contributor signal) — reviewers may not appear above.
		const peer = await this.prisma.projectPeerReview.groupBy({
			by: ["reviewerUserId"],
			where: {
				reviewerUserId: enrolledIds ? { in: enrolledIds } : { not: null },
				...(since ? { createdAt: { gte: since } } : {}),
			},
			_count: { _all: true },
		});
		const peerByUser = new Map<string, number>();
		for (const p of peer) {
			if (!p.reviewerUserId) continue;
			peerByUser.set(p.reviewerUserId, p._count._all);
			get(p.reviewerUserId);
		}

		const streaks = await this.prisma.userStreak.findMany({
			where: { userId: { in: [...base.keys()] } },
			select: { userId: true, longest: true },
		});
		const longestByUser = new Map(streaks.map((s) => [s.userId, s.longest]));

		const result = new Map<string, UserSignals>();
		for (const [uid, s] of base) {
			result.set(uid, {
				userId: uid,
				...s,
				longestStreak: longestByUser.get(uid) ?? 0,
				activeDays: activeDates.get(uid)?.size ?? 0,
				improvement: computeImprovement(attempts.get(uid) ?? []),
				peerReviews: peerByUser.get(uid) ?? 0,
			});
		}
		return result;
	}

	private async computeUserBoard(
		type: LeaderboardType,
		cohortId: string | undefined,
		since: Date | null,
	): Promise<RankedSubject[]> {
		const signals = await this.gatherSignals(cohortId, since);
		const entries = [...signals.values()].map((s) => ({
			subjectId: s.userId,
			score: scoreFor(type, s),
		}));
		return assignRanks(entries);
	}

	private async computeGroupBoard(
		cohortId: string | undefined,
		since: Date | null,
	): Promise<RankedSubject[]> {
		const signals = await this.gatherSignals(cohortId, since);
		const overallByUser = new Map(
			[...signals].map(([id, s]) => [id, overallScore(s)]),
		);
		const groups = await this.prisma.group.findMany({
			where: cohortId ? { cohortId } : {},
			select: { id: true, members: { select: { userId: true } } },
		});
		const entries = groups.map((g) => {
			const scores = g.members.map((m) => overallByUser.get(m.userId) ?? 0);
			const avg = scores.length
				? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
				: 0;
			return { subjectId: g.id, score: avg };
		});
		return assignRanks(entries);
	}

	private async namesFor(
		type: LeaderboardType,
		ids: string[],
	): Promise<Map<string, string>> {
		if (ids.length === 0) return new Map();
		if (type === "group") {
			const groups = await this.prisma.group.findMany({
				where: { id: { in: ids } },
				select: { id: true, name: true },
			});
			return new Map(groups.map((g) => [g.id, g.name ?? "Group"]));
		}
		const users = await this.prisma.user.findMany({
			where: { id: { in: ids } },
			select: { id: true, name: true, firstName: true, lastName: true },
		});
		return new Map(
			users.map((u) => [
				u.id,
				u.name?.trim() || `${u.firstName} ${u.lastName}`.trim(),
			]),
		);
	}

	private async present(
		actor: AuthenticatedUser,
		type: LeaderboardType,
		cohortId: string | undefined,
		period: LeaderboardPeriod,
		full: RankedSubject[],
		limit: number,
	) {
		const sliced = full.slice(0, limit);
		const selfIds = new Set<string>();
		let me: RankedSubject | null = null;

		if (type === "group") {
			const memberships = await this.prisma.groupMember.findMany({
				where: {
					userId: actor.id,
					...(cohortId ? { group: { cohortId } } : {}),
				},
				select: { groupId: true },
			});
			for (const m of memberships) selfIds.add(m.groupId);
			me =
				full
					.filter((e) => selfIds.has(e.subjectId))
					.sort((a, b) => a.rank - b.rank)[0] ?? null;
		} else {
			selfIds.add(actor.id);
			me = full.find((e) => e.subjectId === actor.id) ?? null;
		}

		const neededIds = new Set([
			...sliced.map((s) => s.subjectId),
			...(me ? [me.subjectId] : []),
		]);
		const names = await this.namesFor(type, [...neededIds]);
		const toEntry = (r: RankedSubject) => ({
			rank: r.rank,
			score: r.score,
			subjectId: r.subjectId,
			name: names.get(r.subjectId) ?? "—",
			isSelf: selfIds.has(r.subjectId),
		});

		return {
			type,
			period,
			cohortId: cohortId ?? null,
			kind: type === "group" ? ("group" as const) : ("user" as const),
			total: full.length,
			entries: sliced.map(toEntry),
			me: me ? toEntry(me) : null,
		};
	}
}
