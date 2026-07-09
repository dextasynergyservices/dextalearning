import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Prisma } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
	type AttemptSubmittedEvent,
	type EnrollmentCreatedEvent,
	type EntityCompletedEvent,
	LearningEvents,
	type LessonCompletedEvent,
	type ProjectGradedEvent,
} from "../../shared/events/learning-events";
import { NotificationsService } from "../notifications/notifications.service";
import {
	type BadgeContext,
	earnedBadges,
	GROWTH_LEAP_MIN_DELTA,
} from "./badges.calculator";
import {
	applyActivity,
	localDateOf,
	type StreakUpdate,
} from "./streak.calculator";

/**
 * Engagement's inbound edge (§6.4): subscribes to learning events, records
 * progress_events, advances streaks and awards badges — all on data this
 * context owns. Handlers run in-process on the emitter's request path, so
 * they NEVER throw: an engagement failure must not break a lesson save.
 */
@Injectable()
export class EngagementEventsHandler {
	private readonly logger = new Logger(EngagementEventsHandler.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly notifications: NotificationsService,
	) {}

	@OnEvent(LearningEvents.LessonCompleted)
	async onLessonCompleted(event: LessonCompletedEvent): Promise<void> {
		await this.guard("LessonCompleted", async () => {
			await this.prisma.progressEvent.create({
				data: {
					userId: event.userId,
					entityType: "lesson",
					entityId: event.lessonId,
					eventType: "completed",
					metadataJson: { courseId: event.courseId },
				},
			});
			const streak = await this.recordDailyActivity(event.userId);
			await this.awardBadges(event.userId, { streak });
		});
	}

	@OnEvent(LearningEvents.EntityCompleted)
	async onEntityCompleted(event: EntityCompletedEvent): Promise<void> {
		await this.guard("EntityCompleted", async () => {
			await this.prisma.progressEvent.create({
				data: {
					userId: event.userId,
					entityType: event.entityType,
					entityId: event.entityId,
					eventType: "completed",
				},
			});
			// Completion flips happen during progress reads, not learner actions
			// — they award badges but never extend streaks.
			await this.awardBadges(event.userId, {});
		});
	}

	@OnEvent(LearningEvents.AttemptSubmitted)
	async onAttemptSubmitted(event: AttemptSubmittedEvent): Promise<void> {
		await this.guard("AttemptSubmitted", async () => {
			// Growth leap (§3.1 retrieval practice): a passed post-lesson quiz
			// beating the SAME lesson's pre-quiz score by a real margin —
			// compared against Engagement's own prior events, never another
			// context's tables.
			let growthLeap = false;
			if (event.scope === "lesson_post" && event.passed && event.lessonId) {
				const pre = await this.prisma.progressEvent.findFirst({
					where: {
						userId: event.userId,
						entityType: "assessment",
						eventType: "attempt_submitted",
						AND: [
							{
								metadataJson: {
									path: ["lessonId"],
									equals: event.lessonId,
								},
							},
							{ metadataJson: { path: ["scope"], equals: "lesson_pre" } },
						],
					},
					orderBy: { createdAt: "asc" },
				});
				const preScore = this.scoreOf(pre?.metadataJson);
				growthLeap =
					preScore != null && event.score - preScore >= GROWTH_LEAP_MIN_DELTA;
			}

			await this.prisma.progressEvent.create({
				data: {
					userId: event.userId,
					entityType: "assessment",
					entityId: event.assessmentId,
					eventType: "attempt_submitted",
					metadataJson: {
						score: event.score,
						passed: event.passed,
						scope: event.scope,
						lessonId: event.lessonId,
						attemptNumber: event.attemptNumber,
					},
				},
			});
			const streak = await this.recordDailyActivity(event.userId);
			await this.awardBadges(event.userId, {
				streak,
				perfectQuiz: event.passed && event.score === 100,
				growthLeap,
			});
		});
	}

	@OnEvent(LearningEvents.ProjectGraded)
	async onProjectGraded(event: ProjectGradedEvent): Promise<void> {
		await this.guard("ProjectGraded", async () => {
			await this.prisma.progressEvent.create({
				data: {
					userId: event.userId,
					entityType: "project",
					entityId: event.projectId,
					eventType: "graded",
					metadataJson: {
						score: event.score,
						passed: event.passed,
						submissionId: event.submissionId,
					},
				},
			});
			// Grading is the grader's action, not the learner's — no streak.
			await this.awardBadges(event.userId, {});
		});
	}

	@OnEvent(LearningEvents.EnrollmentCreated)
	async onEnrollmentCreated(event: EnrollmentCreatedEvent): Promise<void> {
		await this.guard("EnrollmentCreated", async () => {
			await this.prisma.progressEvent.create({
				data: {
					userId: event.userId,
					entityType: event.entityType,
					entityId: event.entityId,
					eventType: "enrolled",
				},
			});
		});
	}

	/** Subscriber failures are logged, never rethrown into the emitter. */
	private async guard(name: string, fn: () => Promise<void>): Promise<void> {
		try {
			await fn();
		} catch (error) {
			this.logger.error(
				`Engagement handler ${name} failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
	}

	private scoreOf(metadata: unknown): number | null {
		if (metadata && typeof metadata === "object" && "score" in metadata) {
			const value = (metadata as { score?: unknown }).score;
			return typeof value === "number" ? value : null;
		}
		return null;
	}

	/**
	 * Advances the streak for "the learner did something today" in the user's
	 * OWN timezone. Serializable + one retry: two qualifying events landing in
	 * the same instant (quiz pass + lesson completion) must count one day, not
	 * lose it to a write race.
	 */
	private async recordDailyActivity(userId: string): Promise<StreakUpdate> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { timezone: true },
		});
		const localToday = localDateOf(new Date(), user?.timezone);

		const run = () =>
			this.prisma.$transaction(
				async (tx) => {
					const row = await tx.userStreak.findUnique({ where: { userId } });
					const update = applyActivity(
						{
							current: row?.current ?? 0,
							longest: row?.longest ?? 0,
							freezes: row?.freezes ?? 0,
							lastActiveDate: row?.lastActiveDate
								? row.lastActiveDate.toISOString().slice(0, 10)
								: null,
						},
						localToday,
					);
					if (!update.changed) return update;
					const data = {
						current: update.current,
						longest: update.longest,
						freezes: update.freezes,
						lastActiveDate: new Date(update.lastActiveDate as string),
					};
					await tx.userStreak.upsert({
						where: { userId },
						create: { userId, ...data },
						update: data,
					});
					return update;
				},
				{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
			);

		try {
			return await run();
		} catch (error) {
			if ((error as { code?: string }).code === "P2034") return await run();
			throw error;
		}
	}

	/** Builds the badge context from Engagement-owned data and persists awards. */
	private async awardBadges(
		userId: string,
		trigger: {
			streak?: StreakUpdate;
			perfectQuiz?: boolean;
			growthLeap?: boolean;
		},
	): Promise<void> {
		const [lessons, courses, passedQuizzes, passedProject, streakRow] =
			await Promise.all([
				this.prisma.progressEvent.findMany({
					where: { userId, entityType: "lesson", eventType: "completed" },
					distinct: ["entityId"],
					select: { entityId: true },
				}),
				this.prisma.progressEvent.findMany({
					where: { userId, entityType: "course", eventType: "completed" },
					distinct: ["entityId"],
					select: { entityId: true },
				}),
				// Distinct assessments passed — quizzes_10 rewards breadth of
				// retrieval practice, not re-passing one quiz ten times.
				this.prisma.progressEvent.findMany({
					where: {
						userId,
						entityType: "assessment",
						eventType: "attempt_submitted",
						metadataJson: { path: ["passed"], equals: true },
					},
					distinct: ["entityId"],
					select: { entityId: true },
				}),
				this.prisma.progressEvent.findFirst({
					where: {
						userId,
						entityType: "project",
						eventType: "graded",
						metadataJson: { path: ["passed"], equals: true },
					},
					select: { id: true },
				}),
				trigger.streak
					? Promise.resolve(null)
					: this.prisma.userStreak.findUnique({ where: { userId } }),
			]);

		const ctx: BadgeContext = {
			lessonsCompleted: lessons.length,
			coursesCompleted: courses.length,
			quizzesPassed: passedQuizzes.length,
			perfectQuiz: trigger.perfectQuiz ?? false,
			growthLeap: trigger.growthLeap ?? false,
			streakCurrent: trigger.streak?.current ?? streakRow?.current ?? 0,
			freezeConsumed: (trigger.streak?.freezesConsumed ?? 0) > 0,
			projectsPassed: passedProject ? 1 : 0,
		};
		const keys = earnedBadges(ctx);
		if (keys.length === 0) return;
		// Diff against what's already held so only genuinely-new awards notify
		// (§8.6 in-app channel) — createMany still dedups the awards themselves.
		const held = await this.prisma.userBadge.findMany({
			where: { userId, badgeKey: { in: keys } },
			select: { badgeKey: true },
		});
		const heldKeys = new Set(held.map((b) => b.badgeKey));
		const newKeys = keys.filter((key) => !heldKeys.has(key));
		if (newKeys.length === 0) return;
		await this.prisma.userBadge.createMany({
			data: newKeys.map((badgeKey) => ({ userId, badgeKey })),
			skipDuplicates: true,
		});
		for (const badgeKey of newKeys) {
			await this.notifications.notify(userId, {
				type: "badge_awarded",
				dataJson: { badgeKey },
				inApp: true,
			});
		}
	}
}
