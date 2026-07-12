import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Engagement's thin PUBLIC interface for other contexts (§6.4 rule 1: "each
 * context … exposes a small public service interface"). Reminders calls this
 * instead of reading `user_streaks` directly — the only sanctioned way in.
 */
@Injectable()
export class EngagementQueryService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Streaks that could be at risk "today". Over-fetches a 2-day UTC window
	 * (timezone spread); the caller re-checks exact at-risk-ness per user in
	 * that user's own timezone.
	 */
	async listStreaksAtRisk(): Promise<
		{ userId: string; current: number; lastActiveDate: string }[]
	> {
		const windowStart = new Date(Date.now() - 3 * 86_400_000);
		const rows = await this.prisma.userStreak.findMany({
			where: { current: { gt: 0 }, lastActiveDate: { gte: windowStart } },
			select: { userId: true, current: true, lastActiveDate: true },
		});
		return rows
			.filter((r) => r.lastActiveDate != null)
			.map((r) => ({
				userId: r.userId,
				current: r.current,
				lastActiveDate: (r.lastActiveDate as Date).toISOString().slice(0, 10),
			}));
	}

	/**
	 * Per-user activity summary since `since` (Learning Coach weekly analysis,
	 * §4.10). Derived entirely from Engagement-owned tables (progress_events +
	 * streaks) so no other context reads them — the sanctioned way in (§6.4).
	 * Only users with at least one relevant learning action are returned.
	 */
	async listWeeklyActivity(since: Date): Promise<WeeklyActivity[]> {
		const [events, badges, streaks] = await Promise.all([
			this.prisma.progressEvent.findMany({
				where: { createdAt: { gte: since }, userId: { not: null } },
				select: {
					userId: true,
					entityType: true,
					eventType: true,
					metadataJson: true,
				},
			}),
			this.prisma.userBadge.groupBy({
				by: ["userId"],
				where: { awardedAt: { gte: since } },
				_count: { _all: true },
			}),
			this.prisma.userStreak.findMany({
				select: { userId: true, current: true, lastActiveDate: true },
			}),
		]);

		const byUser = new Map<string, WeeklyActivity>();
		const ensure = (userId: string): WeeklyActivity => {
			let a = byUser.get(userId);
			if (!a) {
				a = {
					userId,
					lessonsCompleted: 0,
					quizzesPassed: 0,
					quizzesFailed: 0,
					avgQuizScore: null,
					coursesCompleted: 0,
					badgesEarned: 0,
					currentStreak: 0,
					streakAtRisk: false,
				};
				byUser.set(userId, a);
			}
			return a;
		};

		const quizScoreSum = new Map<string, { sum: number; n: number }>();
		for (const e of events) {
			if (!e.userId) continue;
			const a = ensure(e.userId);
			if (e.entityType === "lesson" && e.eventType === "completed") {
				a.lessonsCompleted += 1;
			} else if (e.entityType === "course" && e.eventType === "completed") {
				a.coursesCompleted += 1;
			} else if (
				e.entityType === "assessment" &&
				e.eventType === "attempt_submitted"
			) {
				const meta = (e.metadataJson ?? {}) as {
					passed?: boolean;
					score?: number;
				};
				if (meta.passed) a.quizzesPassed += 1;
				else a.quizzesFailed += 1;
				if (typeof meta.score === "number") {
					const acc = quizScoreSum.get(e.userId) ?? { sum: 0, n: 0 };
					acc.sum += meta.score;
					acc.n += 1;
					quizScoreSum.set(e.userId, acc);
				}
			}
		}

		const badgeByUser = new Map(badges.map((b) => [b.userId, b._count._all]));
		const streakByUser = new Map(streaks.map((s) => [s.userId, s]));
		const todayUtc = new Date().toISOString().slice(0, 10);
		const yesterdayUtc = new Date(Date.now() - 86_400_000)
			.toISOString()
			.slice(0, 10);

		for (const a of byUser.values()) {
			a.badgesEarned = badgeByUser.get(a.userId) ?? 0;
			const acc = quizScoreSum.get(a.userId);
			a.avgQuizScore = acc && acc.n > 0 ? Math.round(acc.sum / acc.n) : null;
			const streak = streakByUser.get(a.userId);
			a.currentStreak = streak?.current ?? 0;
			const last = streak?.lastActiveDate
				? (streak.lastActiveDate as Date).toISOString().slice(0, 10)
				: null;
			// Alive streak that hasn't been extended today (roughly at-risk, UTC).
			a.streakAtRisk =
				a.currentStreak > 0 && last !== todayUtc && last === yesterdayUtc;
		}

		return [...byUser.values()];
	}

	/**
	 * This week's lesson + quiz counts for ONE user (Adaptive Pacing, §4.10).
	 * Focused single-user read of Engagement-owned `progress_events` (§6.4).
	 */
	async weeklyActivityFor(
		userId: string,
		since: Date,
	): Promise<{
		lessonsCompleted: number;
		quizzesPassed: number;
		quizzesFailed: number;
	}> {
		const events = await this.prisma.progressEvent.findMany({
			where: { userId, createdAt: { gte: since } },
			select: { entityType: true, eventType: true, metadataJson: true },
		});
		let lessonsCompleted = 0;
		let quizzesPassed = 0;
		let quizzesFailed = 0;
		for (const e of events) {
			if (e.entityType === "lesson" && e.eventType === "completed") {
				lessonsCompleted += 1;
			} else if (
				e.entityType === "assessment" &&
				e.eventType === "attempt_submitted"
			) {
				const meta = (e.metadataJson ?? {}) as { passed?: boolean };
				if (meta.passed) quizzesPassed += 1;
				else quizzesFailed += 1;
			}
		}
		return { lessonsCompleted, quizzesPassed, quizzesFailed };
	}

	/**
	 * Per-user activity signals for the drop-off predictor (§4.10): last learning
	 * action + count of actions since `recentSince`. Only users with at least one
	 * progress event appear — an absent user has never been active. Reads only
	 * Engagement-owned `progress_events` (§6.4).
	 */
	async activitySignalsFor(
		userIds: string[],
		recentSince: Date,
	): Promise<Map<string, { lastActive: Date; recentActions: number }>> {
		const out = new Map<string, { lastActive: Date; recentActions: number }>();
		if (userIds.length === 0) return out;
		const events = await this.prisma.progressEvent.findMany({
			where: { userId: { in: userIds } },
			select: { userId: true, createdAt: true },
		});
		for (const e of events) {
			if (!e.userId) continue;
			const cur = out.get(e.userId);
			if (!cur) {
				out.set(e.userId, {
					lastActive: e.createdAt,
					recentActions: e.createdAt >= recentSince ? 1 : 0,
				});
			} else {
				if (e.createdAt > cur.lastActive) cur.lastActive = e.createdAt;
				if (e.createdAt >= recentSince) cur.recentActions += 1;
			}
		}
		return out;
	}
}

export interface WeeklyActivity {
	userId: string;
	lessonsCompleted: number;
	quizzesPassed: number;
	quizzesFailed: number;
	avgQuizScore: number | null;
	coursesCompleted: number;
	badgesEarned: number;
	currentStreak: number;
	streakAtRisk: boolean;
}
