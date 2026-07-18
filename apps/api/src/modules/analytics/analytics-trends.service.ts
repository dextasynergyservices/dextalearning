import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../../generated/prisma/client";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";

export type TrendEntityType = "course" | "path" | "cohort";

/** One day of enrolments, split by what was enrolled into. */
export interface EnrolmentTrendPoint {
	/** UTC calendar day, YYYY-MM-DD. */
	date: string;
	courses: number;
	paths: number;
	cohorts: number;
}

/** One month of money the creator actually earned (§8.5.1 commercial ledger). */
export interface EarningsTrendPoint {
	/** First day of the UTC month, YYYY-MM. */
	month: string;
	/** Guaranteed revenue cut, booked when the order was paid. */
	guaranteed: number;
	/** Forfeited Earn-Back cut, booked when the escrow resolved. */
	fromEscrow: number;
}

export interface FunnelStage {
	key: "enrolled" | "started" | "completed";
	count: number;
}

/** One month of platform money, same definitions as §14.1.1. */
export interface PlatformRevenueTrendPoint {
	/** UTC month, YYYY-MM. */
	month: string;
	/** What learners paid (settled orders only). */
	gross: number;
	/** Fee + platform cut of guaranteed revenue, off the frozen snapshot. */
	platformTake: number;
	/** Instructors' cut of guaranteed revenue. */
	instructorEarnings: number;
}

export interface AntiCheatSummary {
	/** Attempts submitted in the window. */
	attempts: number;
	/** integrityScore < 100 — something was flagged. */
	flagged: number;
	/** cameraMonitored = false — NOBODY was watching (§4.6.2.1). */
	unmonitored: number;
	escalated: number;
	invalidated: number;
	/** Event counts by type, descending — the "what happens most" bars. */
	eventCounts: { eventType: string; count: number }[];
}

/** How everyone enrolled in the caller's content splits, right now. */
export interface OutcomeDistribution {
	notStarted: number;
	inProgress: number;
	completed: number;
}

/** How the caller's resolved Earn-Back sales ended (§4.11.4). */
export interface EarnBackOutcomes {
	onTime: number;
	late: number;
	missed: number;
}

/** One cell of the when-do-learners-study heatmap (UTC). */
export interface HeatmapCell {
	/** 0 = Sunday … 6 = Saturday. */
	dow: number;
	/** 0–23. */
	hour: number;
	count: number;
}

export interface RevenueByType {
	entityType: "course" | "path" | "cohort";
	gross: number;
}

export interface LearnerGrowthPoint {
	/** UTC month, YYYY-MM. */
	month: string;
	/** Total learners registered by the end of that month (cumulative). */
	total: number;
}

/**
 * Time-series read models for the analytics dashboards (§15). Same charter as
 * AnalyticsService: documented analytical reads ACROSS other contexts' tables,
 * zero writes, zero domain behaviour — extract it onto a read replica and
 * nothing else changes (§6.4).
 *
 * Buckets are UTC calendar days/months (raw `date_trunc`), stated on the
 * charts. Money follows the two-ledgers rule (§8.5.1): a month's earnings are
 * the guaranteed cut of orders PAID that month plus the forfeited escrow cut
 * of resolutions BOOKED that month — at-stake escrow never appears, and the
 * lifetime total therefore reconciles with the Earn-Back ledger.
 */
@Injectable()
export class AnalyticsTrendsService {
	constructor(private readonly prisma: PrismaService) {}

	/** Content this instructor may read analytics for. Admin = everything. */
	private async scopeIds(user: AuthenticatedUser): Promise<{
		courseIds: string[];
		pathIds: string[];
		cohortIds: string[];
	}> {
		const owner = user.role === "admin" ? undefined : user.id;
		const [courses, paths, cohortsOwned, cohortsTaught] = await Promise.all([
			this.prisma.course.findMany({
				where: owner ? { createdBy: owner } : {},
				select: { id: true },
			}),
			this.prisma.learningPath.findMany({
				where: owner ? { createdBy: owner } : {},
				select: { id: true },
			}),
			this.prisma.cohort.findMany({
				where: owner ? { createdBy: owner } : {},
				select: { id: true },
			}),
			// Cohorts are admin-created; the instructor's claim to one is a
			// teaching ASSIGNMENT (§4.7 CohortInstructor), not ownership.
			owner
				? this.prisma.cohortInstructor.findMany({
						where: { userId: owner },
						select: { cohortId: true },
					})
				: Promise.resolve([]),
		]);
		return {
			courseIds: courses.map((c) => c.id),
			pathIds: paths.map((p) => p.id),
			cohortIds: [
				...new Set([
					...cohortsOwned.map((c) => c.id),
					...cohortsTaught.map((c) => c.cohortId),
				]),
			],
		};
	}

	/**
	 * Daily enrolments into the caller's content over the last `days` days,
	 * one series per entity type. Zero-filled: a day with no enrolments is a
	 * data point, not a gap — otherwise the line lies by omission.
	 */
	async enrolmentTrend(
		user: AuthenticatedUser,
		days: number,
	): Promise<EnrolmentTrendPoint[]> {
		const window = Math.min(365, Math.max(7, days));
		const since = new Date(Date.now() - window * 86_400_000);
		const { courseIds, pathIds, cohortIds } = await this.scopeIds(user);

		const bucketed = async (
			table: "course_enrollments" | "path_enrollments" | "cohort_enrollments",
			column: "course_id" | "path_id" | "cohort_id",
			ids: string[],
		): Promise<Map<string, number>> => {
			if (ids.length === 0) return new Map();
			const rows = await this.prisma.$queryRaw<
				{ day: Date; count: bigint }[]
			>(Prisma.sql`
				SELECT date_trunc('day', enrolled_at AT TIME ZONE 'UTC') AS day,
				       count(*)::bigint AS count
				FROM ${Prisma.raw(table)}
				WHERE ${Prisma.raw(column)} = ANY(${ids}::uuid[])
				  AND enrolled_at >= ${since}
				GROUP BY 1
			`);
			return new Map(
				rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]),
			);
		};

		const [courses, paths, cohorts] = await Promise.all([
			bucketed("course_enrollments", "course_id", courseIds),
			bucketed("path_enrollments", "path_id", pathIds),
			bucketed("cohort_enrollments", "cohort_id", cohortIds),
		]);

		const points: EnrolmentTrendPoint[] = [];
		for (let i = window - 1; i >= 0; i--) {
			const date = new Date(Date.now() - i * 86_400_000)
				.toISOString()
				.slice(0, 10);
			points.push({
				date,
				courses: courses.get(date) ?? 0,
				paths: paths.get(date) ?? 0,
				cohorts: cohorts.get(date) ?? 0,
			});
		}
		return points;
	}

	/**
	 * Monthly earnings over the last `months` months, split into the two ways a
	 * creator earns (§8.5.1): the guaranteed cut (at paid time) and forfeited
	 * Earn-Back (at resolution time). Zero-filled per month.
	 */
	async earningsTrend(
		user: AuthenticatedUser,
		months: number,
	): Promise<EarningsTrendPoint[]> {
		const window = Math.min(24, Math.max(3, months));
		const now = new Date();
		const since = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (window - 1), 1),
		);

		const [guaranteedRows, escrowRows] = await Promise.all([
			this.prisma.$queryRaw<{ month: Date; total: number }[]>(Prisma.sql`
				SELECT date_trunc('month', paid_at AT TIME ZONE 'UTC') AS month,
				       COALESCE(sum(instructor_amount), 0)::float AS total
				FROM orders
				WHERE instructor_id = ${user.id}::uuid
				  AND status IN ('paid', 'earn_back_issued')
				  AND paid_at >= ${since}
				GROUP BY 1
			`),
			this.prisma.$queryRaw<{ month: Date; total: number }[]>(Prisma.sql`
				SELECT date_trunc('month', t.calculated_at AT TIME ZONE 'UTC') AS month,
				       COALESCE(sum(t.forfeited_instructor_cut), 0)::float AS total
				FROM earn_back_transactions t
				JOIN orders o ON o.id = t.order_id
				WHERE o.instructor_id = ${user.id}::uuid
				  AND t.calculated_at >= ${since}
				GROUP BY 1
			`),
		]);

		const key = (d: Date) => d.toISOString().slice(0, 7);
		const guaranteed = new Map(
			guaranteedRows.map((r) => [key(r.month), r.total]),
		);
		const escrow = new Map(escrowRows.map((r) => [key(r.month), r.total]));

		const points: EarningsTrendPoint[] = [];
		for (let i = window - 1; i >= 0; i--) {
			const month = new Date(
				Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
			)
				.toISOString()
				.slice(0, 7);
			points.push({
				month,
				guaranteed: guaranteed.get(month) ?? 0,
				fromEscrow: escrow.get(month) ?? 0,
			});
		}
		return points;
	}

	/**
	 * Monthly platform money over the last `months` months (admin-only at the
	 * controller). Same definitions as the §14.1.1 read-model — settled orders
	 * only, all off the frozen snapshot columns — so the trend's lifetime total
	 * reconciles with /admin/earnings, bucketed by when each order was PAID.
	 * Held/refunded Earn-Back is deliberately absent: it is learners' money in
	 * escrow, not revenue (§14.1.1), and a revenue chart must not paint it.
	 */
	async platformRevenueTrend(
		months: number,
	): Promise<PlatformRevenueTrendPoint[]> {
		const window = Math.min(24, Math.max(3, months));
		const now = new Date();
		const since = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (window - 1), 1),
		);

		const rows = await this.prisma.$queryRaw<
			{ month: Date; gross: number; platform: number; instructors: number }[]
		>(Prisma.sql`
			SELECT date_trunc('month', paid_at AT TIME ZONE 'UTC') AS month,
			       COALESCE(sum(amount), 0)::float            AS gross,
			       COALESCE(sum(platform_amount), 0)::float   AS platform,
			       COALESCE(sum(instructor_amount), 0)::float AS instructors
			FROM orders
			WHERE status IN ('paid', 'earn_back_issued')
			  AND paid_at >= ${since}
			GROUP BY 1
		`);
		const byMonth = new Map(
			rows.map((r) => [r.month.toISOString().slice(0, 7), r]),
		);

		const points: PlatformRevenueTrendPoint[] = [];
		for (let i = window - 1; i >= 0; i--) {
			const month = new Date(
				Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
			)
				.toISOString()
				.slice(0, 7);
			const row = byMonth.get(month);
			points.push({
				month,
				gross: row?.gross ?? 0,
				platformTake: row?.platform ?? 0,
				instructorEarnings: row?.instructors ?? 0,
			});
		}
		return points;
	}

	/**
	 * Anti-cheat health over the last `days` days (admin-only at the
	 * controller). `unmonitored` is its own number on purpose: those attempts
	 * score a clean 100, so they are invisible to every integrity filter — the
	 * exact blindness §4.6.2.1 exists to prevent.
	 */
	async antiCheatSummary(days: number): Promise<AntiCheatSummary> {
		const window = Math.min(365, Math.max(7, days));
		const since = new Date(Date.now() - window * 86_400_000);
		const submitted = { submittedAt: { gte: since } } as const;

		const [attempts, flagged, unmonitored, escalated, invalidated, events] =
			await Promise.all([
				this.prisma.assessmentAttempt.count({ where: submitted }),
				this.prisma.assessmentAttempt.count({
					where: { ...submitted, integrityScore: { lt: 100 } },
				}),
				this.prisma.assessmentAttempt.count({
					where: { ...submitted, cameraMonitored: false },
				}),
				this.prisma.assessmentAttempt.count({
					where: { ...submitted, escalated: true },
				}),
				this.prisma.assessmentAttempt.count({
					where: { ...submitted, invalidated: true },
				}),
				this.prisma.assessmentAntiCheatLog.groupBy({
					by: ["eventType"],
					where: { occurredAt: { gte: since } },
					_count: { _all: true },
				}),
			]);

		return {
			attempts,
			flagged,
			unmonitored,
			escalated,
			invalidated,
			eventCounts: events
				.map((e) => ({ eventType: e.eventType, count: e._count._all }))
				.sort((a, b) => b.count - a.count),
		};
	}

	/**
	 * How everyone enrolled in the caller's content splits right now: never
	 * opened it / working on it / done. One number per learner-enrolment, so
	 * the three slices re-sum to total enrolments — a donut that doesn't
	 * reconcile with the enrolment tiles is a bug, not a design choice.
	 */
	async outcomeDistribution(
		user: AuthenticatedUser,
	): Promise<OutcomeDistribution> {
		const { courseIds, pathIds, cohortIds } = await this.scopeIds(user);

		const [enrolled, started, completed] = await Promise.all([
			Promise.all([
				this.prisma.courseEnrollment.count({
					where: { courseId: { in: courseIds } },
				}),
				this.prisma.pathEnrollment.count({
					where: { pathId: { in: pathIds } },
				}),
				this.prisma.cohortEnrollment.count({
					where: { cohortId: { in: cohortIds } },
				}),
			]).then((counts) => counts.reduce((a, b) => a + b, 0)),
			this.prisma.completionStatus.count({
				where: {
					progressPercent: { gt: 0 },
					isComplete: false,
					OR: [
						{ entityType: "course", entityId: { in: courseIds } },
						{ entityType: "path", entityId: { in: pathIds } },
						{ entityType: "cohort", entityId: { in: cohortIds } },
					],
				},
			}),
			this.prisma.completionStatus.count({
				where: {
					isComplete: true,
					OR: [
						{ entityType: "course", entityId: { in: courseIds } },
						{ entityType: "path", entityId: { in: pathIds } },
						{ entityType: "cohort", entityId: { in: cohortIds } },
					],
				},
			}),
		]);

		return {
			// Clamped: a completion row without its enrolment row is a data quirk,
			// and a negative slice would render as garbage.
			notStarted: Math.max(0, enrolled - started - completed),
			inProgress: started,
			completed,
		};
	}

	/**
	 * How the caller's RESOLVED Earn-Back sales ended (§4.11.4): finished in
	 * time (full refund, creator earns 0), finished late (partial forfeit), or
	 * never finished (full forfeit). Open escrows are not an outcome yet and
	 * are deliberately absent.
	 */
	async earnBackOutcomes(user: AuthenticatedUser): Promise<EarnBackOutcomes> {
		const rows = await this.prisma.$queryRaw<
			{ on_time: bigint; late: bigint; missed: bigint }[]
		>(Prisma.sql`
			SELECT
				count(*) FILTER (WHERE t.status <> 'no_payout' AND t.days_late = 0) AS on_time,
				count(*) FILTER (WHERE t.status <> 'no_payout' AND t.days_late > 0) AS late,
				count(*) FILTER (WHERE t.status = 'no_payout')                      AS missed
			FROM earn_back_transactions t
			JOIN orders o ON o.id = t.order_id
			WHERE o.instructor_id = ${user.id}::uuid
		`);
		const r = rows[0];
		return {
			onTime: Number(r?.on_time ?? 0),
			late: Number(r?.late ?? 0),
			missed: Number(r?.missed ?? 0),
		};
	}

	/**
	 * When learning happens: progress events bucketed by UTC day-of-week ×
	 * hour. §15 names `progress_events` as THE learning-analytics source — this
	 * is its first visualisation. Admins see the platform; instructors see
	 * events on their own content (lesson events resolve to the owning course
	 * through the content hierarchy — an analytical read, §6.4-sanctioned).
	 */
	async activityHeatmap(
		user: AuthenticatedUser,
		days: number,
	): Promise<HeatmapCell[]> {
		const window = Math.min(180, Math.max(7, days));
		const since = new Date(Date.now() - window * 86_400_000);

		const scope =
			user.role === "admin"
				? Prisma.sql``
				: Prisma.sql`AND (
						(pe.entity_type = 'lesson' AND pe.entity_id IN (
							SELECT l.id FROM lessons l
							JOIN modules m ON l.module_id = m.id
							JOIN courses c ON m.course_id = c.id
							WHERE c.created_by = ${user.id}::uuid))
						OR (pe.entity_type = 'course' AND pe.entity_id IN (
							SELECT id FROM courses WHERE created_by = ${user.id}::uuid))
						OR (pe.entity_type = 'path' AND pe.entity_id IN (
							SELECT id FROM learning_paths WHERE created_by = ${user.id}::uuid))
					)`;

		const rows = await this.prisma.$queryRaw<
			{ dow: number; hour: number; count: bigint }[]
		>(Prisma.sql`
			SELECT extract(dow  FROM pe.created_at AT TIME ZONE 'UTC')::int AS dow,
			       extract(hour FROM pe.created_at AT TIME ZONE 'UTC')::int AS hour,
			       count(*)::bigint AS count
			FROM progress_events pe
			WHERE pe.created_at >= ${since}
			${scope}
			GROUP BY 1, 2
		`);
		return rows.map((r) => ({
			dow: r.dow,
			hour: r.hour,
			count: Number(r.count),
		}));
	}

	/** Gross settled revenue split by what was sold (admin, §14.1.1). */
	async revenueByType(): Promise<RevenueByType[]> {
		const rows = await this.prisma.$queryRaw<
			{ entity_type: RevenueByType["entityType"]; gross: number }[]
		>(Prisma.sql`
			SELECT entity_type, COALESCE(sum(amount), 0)::float AS gross
			FROM orders
			WHERE status IN ('paid', 'earn_back_issued')
			GROUP BY entity_type
			ORDER BY gross DESC
		`);
		return rows.map((r) => ({ entityType: r.entity_type, gross: r.gross }));
	}

	/**
	 * Cumulative registered learners by month (admin) — the platform's growth
	 * curve. Cumulative rather than per-month, because "how big are we" is the
	 * question a growth chart answers; the monthly delta is its slope.
	 */
	async learnerGrowth(months: number): Promise<LearnerGrowthPoint[]> {
		const window = Math.min(24, Math.max(3, months));
		const now = new Date();
		const since = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (window - 1), 1),
		);

		const [baseline, monthly] = await Promise.all([
			this.prisma.user.count({
				where: { role: "learner", createdAt: { lt: since } },
			}),
			this.prisma.$queryRaw<{ month: Date; count: bigint }[]>(Prisma.sql`
				SELECT date_trunc('month', created_at AT TIME ZONE 'UTC') AS month,
				       count(*)::bigint AS count
				FROM users
				WHERE role = 'learner' AND created_at >= ${since}
				GROUP BY 1
			`),
		]);
		const byMonth = new Map(
			monthly.map((r) => [r.month.toISOString().slice(0, 7), Number(r.count)]),
		);

		const points: LearnerGrowthPoint[] = [];
		let running = baseline;
		for (let i = window - 1; i >= 0; i--) {
			const month = new Date(
				Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
			)
				.toISOString()
				.slice(0, 7);
			running += byMonth.get(month) ?? 0;
			points.push({ month, total: running });
		}
		return points;
	}

	/**
	 * Enrolled → started → completed for one entity. Read access mirrors the
	 * rest of the module — creator or admin — PLUS an assigned cohort
	 * instructor (§4.7): teaching a cohort is exactly the claim that makes its
	 * funnel their business.
	 */
	async completionFunnel(
		user: AuthenticatedUser,
		entityType: TrendEntityType,
		entityId: string,
	): Promise<{ title: string; stages: FunnelStage[] }> {
		const title = await this.assertCanRead(user, entityType, entityId);

		const enrolled =
			entityType === "course"
				? await this.prisma.courseEnrollment.count({
						where: { courseId: entityId },
					})
				: entityType === "path"
					? await this.prisma.pathEnrollment.count({
							where: { pathId: entityId },
						})
					: await this.prisma.cohortEnrollment.count({
							where: { cohortId: entityId },
						});

		const [started, completed] = await Promise.all([
			this.prisma.completionStatus.count({
				where: { entityType, entityId, progressPercent: { gt: 0 } },
			}),
			this.prisma.completionStatus.count({
				where: { entityType, entityId, isComplete: true },
			}),
		]);

		return {
			title,
			stages: [
				{ key: "enrolled", count: enrolled },
				// A learner can't have progress without enrolment, so the funnel is
				// monotone by construction; clamp anyway so a data quirk can never
				// render an uphill funnel.
				{ key: "started", count: Math.min(enrolled, started) },
				{ key: "completed", count: Math.min(enrolled, started, completed) },
			],
		};
	}

	private async assertCanRead(
		user: AuthenticatedUser,
		entityType: TrendEntityType,
		entityId: string,
	): Promise<string> {
		const select = { id: true, title: true, createdBy: true } as const;
		const entity =
			entityType === "course"
				? await this.prisma.course.findUnique({
						where: { id: entityId },
						select,
					})
				: entityType === "path"
					? await this.prisma.learningPath.findUnique({
							where: { id: entityId },
							select,
						})
					: await this.prisma.cohort.findUnique({
							where: { id: entityId },
							select,
						});
		if (!entity) throw new NotFoundException("Content not found");
		if (user.role === "admin" || entity.createdBy === user.id) {
			return entity.title;
		}
		if (entityType === "cohort") {
			const teaches = await this.prisma.cohortInstructor.findFirst({
				where: { cohortId: entityId, userId: user.id },
				select: { cohortId: true },
			});
			if (teaches) return entity.title;
		}
		throw new ForbiddenException("You do not own this content");
	}
}
