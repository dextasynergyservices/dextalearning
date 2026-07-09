import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import { BADGE_KEYS, nextBadgeOf } from "./badge.definitions";
import {
	addDays,
	isAtRisk,
	localDateOf,
	resolveTimezone,
} from "./streak.calculator";

/**
 * Engagement read/write surface for the signed-in learner (§3.2): streak
 * state for the flame, badge awards for celebrations + the awards grid, and
 * public social-proof counters. Reads only Engagement-owned tables.
 */
@Injectable()
export class EngagementService {
	constructor(private readonly prisma: PrismaService) {}

	async getMe(user: AuthenticatedUser) {
		const [streakRow, badges, profile] = await Promise.all([
			this.prisma.userStreak.findUnique({ where: { userId: user.id } }),
			this.prisma.userBadge.findMany({
				where: { userId: user.id },
				orderBy: { awardedAt: "asc" },
			}),
			this.prisma.user.findUnique({
				where: { id: user.id },
				select: { timezone: true },
			}),
		]);

		const timezone = resolveTimezone(profile?.timezone);
		const localToday = localDateOf(new Date(), timezone);
		const lastActiveDate = streakRow?.lastActiveDate
			? streakRow.lastActiveDate.toISOString().slice(0, 10)
			: null;

		// 7-day activity strip (today rightmost), from this context's own events.
		const since = new Date(Date.now() - 8 * 86_400_000);
		const recent = await this.prisma.progressEvent.findMany({
			where: {
				userId: user.id,
				createdAt: { gte: since },
				eventType: { in: ["completed", "attempt_submitted"] },
			},
			select: { createdAt: true },
		});
		const activeDays = new Set(
			recent.map((e) => localDateOf(e.createdAt, timezone)),
		);
		const weekActivity = Array.from({ length: 7 }, (_, i) => {
			const date = addDays(localToday, i - 6);
			return { date, active: activeDays.has(date) };
		});

		// §3.2 goal gradient — the nearest locked countable badge, so the
		// dashboard can say "2 more lessons to unlock X".
		const [lessons, courses, quizzes] = await Promise.all([
			this.prisma.progressEvent.findMany({
				where: {
					userId: user.id,
					entityType: "lesson",
					eventType: "completed",
				},
				distinct: ["entityId"],
				select: { entityId: true },
			}),
			this.prisma.progressEvent.findMany({
				where: {
					userId: user.id,
					entityType: "course",
					eventType: "completed",
				},
				distinct: ["entityId"],
				select: { entityId: true },
			}),
			this.prisma.progressEvent.findMany({
				where: {
					userId: user.id,
					entityType: "assessment",
					eventType: "attempt_submitted",
					metadataJson: { path: ["passed"], equals: true },
				},
				distinct: ["entityId"],
				select: { entityId: true },
			}),
		]);
		const nextBadge = nextBadgeOf(new Set(badges.map((b) => b.badgeKey)), {
			lessons: lessons.length,
			courses: courses.length,
			quizzes: quizzes.length,
			streak: streakRow?.current ?? 0,
		});

		return {
			streak: {
				current: streakRow?.current ?? 0,
				longest: streakRow?.longest ?? 0,
				freezes: streakRow?.freezes ?? 0,
				lastActiveDate,
				atRisk: isAtRisk(lastActiveDate, localToday),
				todayDone: lastActiveDate === localToday,
			},
			weekActivity,
			badges: badges.map((b) => ({
				key: b.badgeKey,
				awardedAt: b.awardedAt,
				seen: b.seenAt != null,
			})),
			unseenBadgeKeys: badges
				.filter((b) => b.seenAt == null)
				.map((b) => b.badgeKey),
			/** The full catalogue, so the awards grid can show locked badges. */
			allBadgeKeys: BADGE_KEYS,
			nextBadge,
		};
	}

	async markBadgesSeen(user: AuthenticatedUser, keys: string[]) {
		await this.prisma.userBadge.updateMany({
			where: { userId: user.id, badgeKey: { in: keys }, seenAt: null },
			data: { seenAt: new Date() },
		});
		return { ok: true as const };
	}

	/** §3.2 social proof — distinct learners who completed a course recently. */
	async getSocialProof(courseId: string) {
		const since = new Date(Date.now() - 7 * 86_400_000);
		const rows = await this.prisma.progressEvent.findMany({
			where: {
				entityType: "course",
				entityId: courseId,
				eventType: "completed",
				createdAt: { gte: since },
			},
			distinct: ["userId"],
			select: { userId: true },
		});
		return { completedThisWeek: rows.length };
	}
}
