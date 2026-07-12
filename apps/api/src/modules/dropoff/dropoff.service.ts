import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EngagementQueryService } from "../engagement/engagement-query.service";
import { NotificationsService } from "../notifications/notifications.service";
import { computeRisk, type RiskResult } from "./dropoff.calculator";

const DAY_MS = 86_400_000;
const RECENT_WINDOW_DAYS = 14;

/**
 * Drop-off predictor (§4.10). A daily sweep scores every cohort learner's
 * disengagement (pure calculator) and stores medium/high flags for their
 * instructors + facilitators, alerting staff when a cohort gains high-risk
 * learners. An analytical/reporting context: it reads enrolment + completion
 * snapshots and Engagement's exported signals (like Teaching/Analytics), and
 * delivers through the Notifications context (§6.4).
 */
@Injectable()
export class DropoffService {
	private readonly logger = new Logger(DropoffService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly engagementQuery: EngagementQueryService,
		private readonly notifications: NotificationsService,
	) {}

	async sweep(
		now: Date = new Date(),
	): Promise<{ cohorts: number; flagged: number }> {
		const enrollments = await this.prisma.cohortEnrollment.findMany({
			where: { NOT: { status: "dropped" } },
			select: { cohortId: true, userId: true, enrolledAt: true },
		});
		if (enrollments.length === 0) return { cohorts: 0, flagged: 0 };

		const cohortIds = [...new Set(enrollments.map((e) => e.cohortId))];
		const userIds = [...new Set(enrollments.map((e) => e.userId))];
		const recentSince = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS);

		const [completions, signals, cohorts] = await Promise.all([
			this.prisma.completionStatus.findMany({
				where: { entityType: "cohort", entityId: { in: cohortIds } },
				select: { entityId: true, userId: true, isComplete: true },
			}),
			this.engagementQuery.activitySignalsFor(userIds, recentSince),
			this.prisma.cohort.findMany({
				where: { id: { in: cohortIds } },
				select: { id: true, title: true },
			}),
		]);

		const completeSet = new Set(
			completions
				.filter((c) => c.isComplete)
				.map((c) => `${c.entityId}:${c.userId}`),
		);
		const cohortTitle = new Map(cohorts.map((c) => [c.id, c.title]));

		// Compute flags per cohort (medium/high only).
		const flagsByCohort = new Map<
			string,
			{ userId: string; risk: RiskResult }[]
		>();
		for (const e of enrollments) {
			const signal = signals.get(e.userId);
			const daysSinceActive = signal
				? Math.floor((now.getTime() - signal.lastActive.getTime()) / DAY_MS)
				: null;
			const risk = computeRisk({
				daysSinceActive,
				daysSinceEnrolled: Math.floor(
					(now.getTime() - e.enrolledAt.getTime()) / DAY_MS,
				),
				isComplete: completeSet.has(`${e.cohortId}:${e.userId}`),
				recentActions: signal?.recentActions ?? 0,
			});
			if (risk.level === "low") continue;
			const list = flagsByCohort.get(e.cohortId) ?? [];
			list.push({ userId: e.userId, risk });
			flagsByCohort.set(e.cohortId, list);
		}

		// Replace all flags for the processed cohorts in one transaction.
		let flagged = 0;
		await this.prisma.$transaction(async (tx) => {
			await tx.dropoffFlag.deleteMany({
				where: { cohortId: { in: cohortIds } },
			});
			for (const [cohortId, list] of flagsByCohort) {
				for (const { userId, risk } of list) {
					await tx.dropoffFlag.create({
						data: {
							cohortId,
							userId,
							level: risk.level,
							score: risk.score,
							reasonsJson: risk.reasons,
							daysInactive: risk.daysInactive,
							computedAt: now,
						},
					});
					flagged += 1;
				}
			}
		});

		await this.alertStaff(flagsByCohort, cohortTitle, now);
		return { cohorts: cohortIds.length, flagged };
	}

	/** Notify each cohort's instructors + facilitators — once per staff/cohort/day. */
	private async alertStaff(
		flagsByCohort: Map<string, { userId: string; risk: RiskResult }[]>,
		cohortTitle: Map<string, string>,
		now: Date,
	): Promise<void> {
		const startOfDay = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		);
		// Only alert on cohorts that actually have high-risk learners.
		const alertCohorts = [...flagsByCohort.entries()].filter(([, list]) =>
			list.some((f) => f.risk.level === "high"),
		);
		if (alertCohorts.length === 0) return;

		const ids = alertCohorts.map(([cohortId]) => cohortId);
		const [instructors, facilitators] = await Promise.all([
			this.prisma.cohortInstructor.findMany({
				where: { cohortId: { in: ids } },
				select: { cohortId: true, userId: true },
			}),
			this.prisma.cohortFacilitator.findMany({
				where: { cohortId: { in: ids } },
				select: { cohortId: true, userId: true },
			}),
		]);
		const staffByCohort = new Map<string, Set<string>>();
		for (const s of [...instructors, ...facilitators]) {
			const set = staffByCohort.get(s.cohortId) ?? new Set<string>();
			set.add(s.userId);
			staffByCohort.set(s.cohortId, set);
		}

		for (const [cohortId, list] of alertCohorts) {
			const high = list.filter((f) => f.risk.level === "high").length;
			const medium = list.filter((f) => f.risk.level === "medium").length;
			const staff = staffByCohort.get(cohortId);
			if (!staff) continue;
			for (const userId of staff) {
				try {
					// Dedup: one alert per staff member per cohort per UTC day.
					const already = await this.prisma.notification.findFirst({
						where: {
							userId,
							type: "dropoff_alert",
							createdAt: { gte: startOfDay },
							dataJson: { path: ["cohortId"], equals: cohortId },
						},
						select: { id: true },
					});
					if (already) continue;
					await this.notifications.notify(userId, {
						type: "dropoff_alert",
						dataJson: {
							cohortId,
							cohortTitle: cohortTitle.get(cohortId) ?? "",
							high,
							medium,
						},
						inApp: true,
					});
				} catch (error) {
					this.logger.error(
						`dropoff alert for ${userId}/${cohortId} failed: ${String(error)}`,
					);
				}
			}
		}
	}
}
