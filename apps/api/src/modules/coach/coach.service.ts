import { Inject, Injectable, Logger } from "@nestjs/common";
import { renderCoachDigestEmail } from "../../emails/render";
import { PrismaService } from "../../prisma/prisma.service";
import { AI_PORT, type AiPort } from "../../shared/ai/ai.port";
import { EngagementQueryService } from "../engagement/engagement-query.service";
import { NotificationsService } from "../notifications/notifications.service";
import { COACH_COPY, coachLanguageOf } from "./coach.messages";

/** Monday 00:00 UTC of the week containing `d` — the digest's dedup key. */
export function weekStartOf(d: Date): Date {
	const date = new Date(
		Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
	);
	const daysSinceMonday = (date.getUTCDay() + 6) % 7;
	date.setUTCDate(date.getUTCDate() - daysSinceMonday);
	return date;
}

/**
 * Learning Coach (§4.10; §3.1 growth mindset). A weekly sweep composes ONE
 * AI-written coaching digest per active learner and delivers it through the
 * Notifications context. Owns `coach_digests` (the row is both the stored
 * digest and the once-per-week send lock).
 *
 * §6.4: weekly activity comes from Engagement's exported query service, never
 * another context's tables; delivery goes through Notifications.
 */
@Injectable()
export class CoachService {
	private readonly logger = new Logger(CoachService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly engagementQuery: EngagementQueryService,
		private readonly notifications: NotificationsService,
		@Inject(AI_PORT) private readonly ai: AiPort,
	) {}

	async sweep(now: Date = new Date()): Promise<{ sent: number }> {
		const since = new Date(now.getTime() - 7 * 86_400_000);
		const weekOf = weekStartOf(now);
		const activity = await this.engagementQuery.listWeeklyActivity(since);

		// Only coach learners who actually did something this week (§ re-engaging
		// the fully idle is the Reminders context's job, not the coach's).
		const meaningful = activity.filter(
			(a) =>
				a.lessonsCompleted > 0 ||
				a.quizzesPassed > 0 ||
				a.quizzesFailed > 0 ||
				a.coursesCompleted > 0,
		);
		if (meaningful.length === 0) return { sent: 0 };

		const byUserId = new Map(meaningful.map((a) => [a.userId, a]));
		const users = await this.prisma.user.findMany({
			where: { id: { in: [...byUserId.keys()] } },
			select: {
				id: true,
				email: true,
				firstName: true,
				phone: true,
				whatsappOptIn: true,
				language: true,
			},
		});

		let sent = 0;
		for (const user of users) {
			const stats = byUserId.get(user.id);
			if (!stats) continue;
			try {
				if (await this.sendFor(user, stats, weekOf)) sent += 1;
			} catch (error) {
				this.logger.error(
					`coach digest for ${user.id} failed: ${String(error)}`,
				);
			}
		}
		return { sent };
	}

	private async sendFor(
		user: {
			id: string;
			email: string;
			firstName: string;
			phone: string | null;
			whatsappOptIn: boolean;
			language: string;
		},
		stats: import("../engagement/engagement-query.service").WeeklyActivity,
		weekOf: Date,
	): Promise<boolean> {
		// The unique (userId, weekOf) row IS the once-per-week lock: claim it
		// first so a concurrent sweep loses the race and we never double-send.
		try {
			await this.prisma.coachDigest.create({
				data: { userId: user.id, weekOf, headline: "", body: "" },
			});
		} catch (error) {
			if ((error as { code?: string }).code === "P2002") return false;
			throw error;
		}

		const language = coachLanguageOf(user.language);
		const copy = COACH_COPY[language];

		let digest: { headline: string; message: string; action: string };
		try {
			digest = await this.aiCoach(user.firstName, language, stats);
		} catch (error) {
			// AI failed — release the lock so a later run can retry this week.
			await this.prisma.coachDigest
				.deleteMany({ where: { userId: user.id, weekOf } })
				.catch(() => {});
			throw error;
		}

		await this.prisma.coachDigest.update({
			where: { userId_weekOf: { userId: user.id, weekOf } },
			data: {
				headline: digest.headline,
				body: digest.message,
				action: digest.action || null,
			},
		});

		await this.notifications.notify(user.id, {
			type: "coach_digest",
			dataJson: {
				headline: digest.headline,
				message: digest.message,
				action: digest.action,
			},
			inApp: true,
			email: {
				to: user.email,
				subject: copy.subject,
				html: await renderCoachDigestEmail({
					headline: digest.headline,
					message: digest.message,
					action: digest.action || undefined,
					actionLabel: copy.actionLabel,
					cta: copy.cta,
				}),
			},
			...(user.phone && user.whatsappOptIn
				? {
						whatsapp: {
							phone: user.phone,
							message: copy.whatsapp(digest.headline, digest.action),
						},
					}
				: {}),
			push: {
				title: copy.subject,
				body: digest.headline,
				url: "/dashboard",
				tag: "coach",
			},
		});
		return true;
	}

	/** Maps the weekly activity snapshot onto the AI port's coaching input. */
	private async aiCoach(
		firstName: string,
		language: string,
		stats: import("../engagement/engagement-query.service").WeeklyActivity,
	) {
		return this.ai.coachWeekly({
			firstName,
			language,
			stats: {
				lessonsCompleted: stats.lessonsCompleted,
				quizzesPassed: stats.quizzesPassed,
				quizzesFailed: stats.quizzesFailed,
				avgQuizScore: stats.avgQuizScore,
				coursesCompleted: stats.coursesCompleted,
				badgesEarned: stats.badgesEarned,
				currentStreak: stats.currentStreak,
				streakAtRisk: stats.streakAtRisk,
			},
		});
	}

	/** The learner's most recent coaching digest (for the dashboard card). */
	async latestFor(userId: string) {
		const row = await this.prisma.coachDigest.findFirst({
			where: { userId, NOT: { headline: "" } },
			orderBy: { createdAt: "desc" },
			select: {
				headline: true,
				body: true,
				action: true,
				weekOf: true,
				createdAt: true,
			},
		});
		if (!row) return null;
		return {
			headline: row.headline,
			message: row.body,
			action: row.action,
			weekOf: row.weekOf.toISOString().slice(0, 10),
			createdAt: row.createdAt.toISOString(),
		};
	}
}
