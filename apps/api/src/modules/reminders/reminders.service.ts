import { Injectable, Logger } from "@nestjs/common";
import { renderReminderDigestEmail } from "../../emails/render";
import { PrismaService } from "../../prisma/prisma.service";
import { EngagementQueryService } from "../engagement/engagement-query.service";
import {
	localDateOf,
	localDayOfWeekOf,
	localHourOf,
} from "../engagement/streak.calculator";
import { NotificationsService } from "../notifications/notifications.service";
import {
	advanceReview,
	isDue,
	isSendWindow,
	pickDigestReviews,
	streakLineKind,
} from "./reminder.calculator";
import {
	anchorPhraseOf,
	DIGEST_COPY,
	reminderLanguageOf,
} from "./reminder.messages";

/**
 * Spaced-repetition + streak reminder sweep (§3.1/§3.2, §8.6 "Streak
 * reminder: email + WhatsApp + in-app"). Runs hourly (BullMQ job scheduler);
 * each pass finds users whose user-local send window is open, composes at
 * most ONE digest per user per local day, delivers it through the
 * Notifications context, and advances the included review ladders.
 *
 * §6.4: candidates come from this context's own `review_items` plus
 * Engagement's exported query service — never another context's tables.
 */
@Injectable()
export class RemindersService {
	private readonly logger = new Logger(RemindersService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly engagementQuery: EngagementQueryService,
		private readonly notifications: NotificationsService,
	) {}

	async sweep(now: Date = new Date()): Promise<{ sent: number }> {
		// Over-fetch dueness by a day so no timezone's "today" is missed;
		// exact dueness is re-checked per user in their own timezone below.
		const horizon = new Date(now.getTime() + 86_400_000);
		const [dueItems, atRiskStreaks] = await Promise.all([
			this.prisma.reviewItem.findMany({
				where: { done: false, nextDueOn: { lte: horizon } },
			}),
			this.engagementQuery.listStreaksAtRisk(),
		]);

		const itemsByUser = new Map<string, typeof dueItems>();
		for (const item of dueItems) {
			const list = itemsByUser.get(item.userId) ?? [];
			list.push(item);
			itemsByUser.set(item.userId, list);
		}
		const streakByUser = new Map(atRiskStreaks.map((s) => [s.userId, s]));
		const candidateIds = [
			...new Set([...itemsByUser.keys(), ...streakByUser.keys()]),
		];
		if (candidateIds.length === 0) return { sent: 0 };

		const users = await this.prisma.user.findMany({
			where: { id: { in: candidateIds } },
			select: {
				id: true,
				email: true,
				firstName: true,
				phone: true,
				whatsappOptIn: true,
				language: true,
				timezone: true,
				studySchedule: true,
				studyAnchor: true,
			},
		});

		let sent = 0;
		for (const user of users) {
			try {
				if (await this.sendDigestFor(user, itemsByUser, streakByUser, now)) {
					sent += 1;
				}
			} catch (error) {
				this.logger.error(`digest for ${user.id} failed: ${String(error)}`);
			}
		}
		return { sent };
	}

	private async sendDigestFor(
		user: {
			id: string;
			email: string;
			firstName: string;
			phone: string | null;
			whatsappOptIn: boolean;
			language: string;
			timezone: string | null;
			studySchedule: string | null;
			studyAnchor: string | null;
		},
		itemsByUser: Map<
			string,
			{
				id: string;
				lessonTitle: string;
				intervalIndex: number;
				completedOn: Date;
				nextDueOn: Date;
			}[]
		>,
		streakByUser: Map<
			string,
			{ userId: string; current: number; lastActiveDate: string }
		>,
		now: Date,
	): Promise<boolean> {
		const localToday = localDateOf(now, user.timezone);
		const window = isSendWindow(
			user.studySchedule,
			localHourOf(now, user.timezone),
			localDayOfWeekOf(now, user.timezone),
		);
		if (!window) return false;

		const due = (itemsByUser.get(user.id) ?? [])
			.map((item) => ({
				...item,
				dueOn: item.nextDueOn.toISOString().slice(0, 10),
			}))
			.filter((item) => isDue(item.dueOn, localToday));
		const streak = streakByUser.get(user.id);
		// §3.2 loss aversion vs §3.1 fresh start: an alive-but-idle streak
		// warns; a broken one gets the clean-slate reframe (which only rides
		// along with due reviews — a lapse alone must never trigger a nag).
		const streakKind = streak
			? streakLineKind(streak.lastActiveDate, localToday, streak.current)
			: null;
		if (due.length === 0 && streakKind !== "at_risk") return false;

		// One digest per user per local day — the unique key IS the lock, so a
		// concurrent sweep loses the race and skips.
		try {
			await this.prisma.reminderLog.create({
				data: { userId: user.id, kind: "digest", sentOn: new Date(localToday) },
			});
		} catch (error) {
			if ((error as { code?: string }).code === "P2002") return false;
			throw error;
		}

		const picked = pickDigestReviews(
			due.map((d) => ({ ...d, nextDueOn: d.dueOn })),
		);
		const language = reminderLanguageOf(user.language);
		const copy = DIGEST_COPY[language];
		const ctx = {
			firstName: user.firstName,
			streakKind,
			streakCurrent: streak?.current ?? 0,
			reviewTitles: picked.map((p) => p.lessonTitle),
			// §3.1 testing effect — the top due lesson becomes a free-recall
			// challenge, so the reminder itself is a retrieval event.
			recallTitle: picked[0]?.lessonTitle ?? null,
			anchorPhrase: anchorPhraseOf(user.studyAnchor, language),
		};

		await this.notifications.notify(user.id, {
			type: "reminder_digest",
			dataJson: {
				streakKind,
				streakCurrent: ctx.streakCurrent,
				reviewCount: due.length,
				reviewTitles: ctx.reviewTitles,
				recallTitle: ctx.recallTitle,
			},
			inApp: true,
			email: {
				to: user.email,
				subject: copy.subject(ctx),
				html: await renderReminderDigestEmail({
					heading: copy.heading(ctx),
					recallLine: ctx.recallTitle ? copy.recallLine(ctx) : undefined,
					streakLine: streakKind ? copy.streakLine(ctx) : undefined,
					reviewsIntro:
						ctx.reviewTitles.length > 0 ? copy.reviewsIntro(ctx) : undefined,
					reviewTitles: ctx.reviewTitles,
					cta: copy.cta,
				}),
			},
			...(user.phone && user.whatsappOptIn
				? { whatsapp: { phone: user.phone, message: copy.whatsapp(ctx) } }
				: {}),
			push: {
				title: copy.subject(ctx),
				body: copy.heading(ctx),
				url: "/dashboard",
				tag: "reminder_digest",
			},
		});

		// Advance only the reviews we actually named — the rest stay due and
		// surface tomorrow (natural smoothing for binge days).
		for (const item of picked) {
			const next = advanceReview({
				intervalIndex: item.intervalIndex,
				completedOn: item.completedOn.toISOString().slice(0, 10),
			});
			await this.prisma.reviewItem.update({
				where: { id: item.id },
				data: {
					intervalIndex: next.intervalIndex,
					nextDueOn: new Date(next.nextDueOn),
					done: next.done,
				},
			});
		}
		return true;
	}
}
