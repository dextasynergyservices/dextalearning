import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";

export type AnalyticsEntityType = "course" | "path" | "cohort";

export const ANALYTICS_ENTITY_TYPES: AnalyticsEntityType[] = [
	"course",
	"path",
	"cohort",
];

/** A live/visible entity per type ("open" is a cohort's "published"). */
const LIVE_STATUS: Record<AnalyticsEntityType, string> = {
	course: "published",
	path: "published",
	cohort: "open",
};

interface EntityRecord {
	id: string;
	title: string;
	status: string | null;
	createdBy: string | null;
}

interface EnrollGroup {
	entityId: string;
	count: number;
	lastEnrolledAt: Date | null;
}

/**
 * Read-only reporting context (blueprint §2.4 "view analytics for own
 * content" / "view all analytics"; the AnalyticsModule in §5's module map;
 * §15 names `progress_events` as the learning-analytics source). This module
 * AGGREGATES across other contexts' tables but never writes them and exposes
 * no domain behavior — a classic read model, which is the sanctioned §6.4
 * shape for cross-context reporting (extractable to its own service with a
 * read replica and nothing else changing).
 */
@Injectable()
export class AnalyticsService {
	constructor(private readonly prisma: PrismaService) {}

	// ── Normalized access per entity type ─────────────────────────────────────

	private async findEntities(
		type: AnalyticsEntityType,
		ownerScope: string | null,
	): Promise<EntityRecord[]> {
		const where = ownerScope ? { createdBy: ownerScope } : {};
		const select = {
			id: true,
			title: true,
			status: true,
			createdBy: true,
		} as const;
		const orderBy = { createdAt: "desc" } as const;
		if (type === "course") {
			return this.prisma.course.findMany({ where, select, orderBy });
		}
		if (type === "path") {
			return this.prisma.learningPath.findMany({ where, select, orderBy });
		}
		return this.prisma.cohort.findMany({ where, select, orderBy });
	}

	private async enrollGroups(
		type: AnalyticsEntityType,
		ids: string[],
	): Promise<EnrollGroup[]> {
		if (type === "course") {
			const groups = await this.prisma.courseEnrollment.groupBy({
				by: ["courseId"],
				where: { courseId: { in: ids } },
				_count: { _all: true },
				_max: { enrolledAt: true },
			});
			return groups.map((g) => ({
				entityId: g.courseId,
				count: g._count._all,
				lastEnrolledAt: g._max.enrolledAt,
			}));
		}
		if (type === "path") {
			const groups = await this.prisma.pathEnrollment.groupBy({
				by: ["pathId"],
				where: { pathId: { in: ids } },
				_count: { _all: true },
				_max: { enrolledAt: true },
			});
			return groups.map((g) => ({
				entityId: g.pathId,
				count: g._count._all,
				lastEnrolledAt: g._max.enrolledAt,
			}));
		}
		const groups = await this.prisma.cohortEnrollment.groupBy({
			by: ["cohortId"],
			where: { cohortId: { in: ids } },
			_count: { _all: true },
			_max: { enrolledAt: true },
		});
		return groups.map((g) => ({
			entityId: g.cohortId,
			count: g._count._all,
			lastEnrolledAt: g._max.enrolledAt,
		}));
	}

	private async findEnrollments(type: AnalyticsEntityType, entityId: string) {
		const include = {
			user: { select: { id: true, firstName: true, lastName: true } },
		} as const;
		const orderBy = { enrolledAt: "desc" } as const;
		if (type === "course") {
			return this.prisma.courseEnrollment.findMany({
				where: { courseId: entityId },
				include,
				orderBy,
			});
		}
		if (type === "path") {
			return this.prisma.pathEnrollment.findMany({
				where: { pathId: entityId },
				include,
				orderBy,
			});
		}
		return this.prisma.cohortEnrollment.findMany({
			where: { cohortId: entityId },
			include,
			orderBy,
		});
	}

	private async distinctLearnerCount(
		type: AnalyticsEntityType,
		ids: string[],
	): Promise<number> {
		if (ids.length === 0) return 0;
		if (type === "course") {
			return (
				await this.prisma.courseEnrollment.findMany({
					where: { courseId: { in: ids } },
					distinct: ["userId"],
					select: { userId: true },
				})
			).length;
		}
		if (type === "path") {
			return (
				await this.prisma.pathEnrollment.findMany({
					where: { pathId: { in: ids } },
					distinct: ["userId"],
					select: { userId: true },
				})
			).length;
		}
		return (
			await this.prisma.cohortEnrollment.findMany({
				where: { cohortId: { in: ids } },
				distinct: ["userId"],
				select: { userId: true },
			})
		).length;
	}

	// ── Per-entity rows ────────────────────────────────────────────────────────

	/**
	 * Per-entity engagement rows: enrolled / completed / in-progress /
	 * not-started + completion rate + average progress.
	 *
	 * `completion_status` rows are created lazily on first progress, so
	 * "started" = has a row; learners enrolled with no row are "not started"
	 * and count as 0% toward the average (honest denominators — an inactive
	 * cohort should drag the average down, not vanish from it).
	 */
	private async entityRows(
		type: AnalyticsEntityType,
		ownerScope: string | null,
	) {
		const entities = await this.findEntities(type, ownerScope);
		const ids = entities.map((e) => e.id);
		if (ids.length === 0) return [];

		const [enrolls, completionGroups] = await Promise.all([
			this.enrollGroups(type, ids),
			this.prisma.completionStatus.groupBy({
				by: ["entityId", "isComplete"],
				where: { entityType: type, entityId: { in: ids } },
				_count: { _all: true },
				_sum: { progressPercent: true },
			}),
		]);

		const enrolledBy = new Map(enrolls.map((g) => [g.entityId, g.count]));
		const lastEnrolledBy = new Map(
			enrolls.map((g) => [g.entityId, g.lastEnrolledAt]),
		);
		const completedBy = new Map<string, number>();
		const startedBy = new Map<string, number>();
		const progressSumBy = new Map<string, number>();
		for (const g of completionGroups) {
			startedBy.set(
				g.entityId,
				(startedBy.get(g.entityId) ?? 0) + g._count._all,
			);
			progressSumBy.set(
				g.entityId,
				(progressSumBy.get(g.entityId) ?? 0) + (g._sum.progressPercent ?? 0),
			);
			if (g.isComplete) completedBy.set(g.entityId, g._count._all);
		}

		return entities.map((entity) => {
			const enrolled = enrolledBy.get(entity.id) ?? 0;
			const completed = completedBy.get(entity.id) ?? 0;
			const started = startedBy.get(entity.id) ?? 0;
			const inProgress = Math.max(0, started - completed);
			const notStarted = Math.max(0, enrolled - completed - inProgress);
			// Progress can exist without enrolment while the payments-phase
			// enrolment hard-gate is pending — clamp rates so a stray row never
			// shows a >100% entity.
			const completionRate =
				enrolled > 0
					? Math.min(100, Math.round((completed / enrolled) * 100))
					: 0;
			const avgProgressPct =
				enrolled > 0
					? Math.min(
							100,
							Math.round((progressSumBy.get(entity.id) ?? 0) / enrolled),
						)
					: 0;
			return {
				id: entity.id,
				title: entity.title,
				status: entity.status,
				live: entity.status === LIVE_STATUS[type],
				createdBy: entity.createdBy,
				enrolled,
				completed,
				inProgress,
				notStarted,
				completionRate,
				avgProgressPct,
				lastEnrolledAt: lastEnrolledBy.get(entity.id) ?? null,
			};
		});
	}

	private totalsOf(rows: Awaited<ReturnType<AnalyticsService["entityRows"]>>) {
		const enrollments = rows.reduce((sum, r) => sum + r.enrolled, 0);
		const completions = rows.reduce((sum, r) => sum + r.completed, 0);
		return {
			items: rows.length,
			published: rows.filter((r) => r.live).length,
			enrollments,
			completions,
			inProgress: rows.reduce((sum, r) => sum + r.inProgress, 0),
			notStarted: rows.reduce((sum, r) => sum + r.notStarted, 0),
			completionRate:
				enrollments > 0
					? Math.min(100, Math.round((completions / enrollments) * 100))
					: 0,
		};
	}

	private stripOwner(
		rows: Awaited<ReturnType<AnalyticsService["entityRows"]>>,
	) {
		return rows.map(({ createdBy: _createdBy, ...row }) => row);
	}

	// ── Overviews ─────────────────────────────────────────────────────────────

	/** Instructor: own content only; admins see everything (§2.4). */
	async instructorOverview(user: AuthenticatedUser) {
		const scope = user.role === "admin" ? null : user.id;
		const [courses, paths] = await Promise.all([
			this.entityRows("course", scope),
			this.entityRows("path", scope),
		]);

		const [courseLearners, pathLearners] = await Promise.all([
			this.distinctLearnerCount(
				"course",
				courses.map((r) => r.id),
			),
			this.distinctLearnerCount(
				"path",
				paths.map((r) => r.id),
			),
		]);

		const combined = [...courses, ...paths];
		return {
			totals: {
				...this.totalsOf(combined),
				courses: courses.length,
				paths: paths.length,
				// Union upper bound isn't computable across two tables without a
				// heavier query; sum of per-type distincts is the honest headline.
				learnersReached: courseLearners + pathLearners,
			},
			courses: this.stripOwner(courses),
			paths: this.stripOwner(paths),
		};
	}

	/** Admin: platform-wide overview + every course/path/cohort. */
	async adminOverview() {
		const since7d = new Date(Date.now() - 7 * 86_400_000);
		const since30d = new Date(Date.now() - 30 * 86_400_000);

		const [
			learners,
			instructors,
			publishedCourses,
			publishedPaths,
			openCohorts,
			enrollments,
			completions,
			active7dRows,
			newLearners30d,
			courses,
			paths,
			cohorts,
		] = await Promise.all([
			this.prisma.user.count({ where: { role: "learner" } }),
			this.prisma.user.count({ where: { role: "instructor" } }),
			this.prisma.course.count({ where: { status: "published" } }),
			this.prisma.learningPath.count({ where: { status: "published" } }),
			this.prisma.cohort.count({ where: { status: "open" } }),
			this.prisma.courseEnrollment.count(),
			this.prisma.completionStatus.count({
				where: { entityType: "course", isComplete: true },
			}),
			// §15: progress_events is the learning-analytics stream — distinct
			// learners with ANY learning activity in the window.
			this.prisma.progressEvent.findMany({
				where: { createdAt: { gte: since7d } },
				distinct: ["userId"],
				select: { userId: true },
			}),
			this.prisma.user.count({
				where: { role: "learner", createdAt: { gte: since30d } },
			}),
			this.entityRows("course", null),
			this.entityRows("path", null),
			this.entityRows("cohort", null),
		]);

		// Resolve creator names for the tables in one query.
		const ownerIds = [
			...new Set(
				[...courses, ...paths, ...cohorts]
					.map((r) => r.createdBy)
					.filter((id): id is string => !!id),
			),
		];
		const owners = ownerIds.length
			? await this.prisma.user.findMany({
					where: { id: { in: ownerIds } },
					select: { id: true, firstName: true, lastName: true },
				})
			: [];
		const ownerName = new Map(
			owners.map((o) => [o.id, `${o.firstName} ${o.lastName}`.trim()]),
		);
		const withOwner = (
			rows: Awaited<ReturnType<AnalyticsService["entityRows"]>>,
		) =>
			rows.map(({ createdBy, ...row }) => ({
				...row,
				instructorName: createdBy ? (ownerName.get(createdBy) ?? null) : null,
			}));

		return {
			platform: {
				learners,
				instructors,
				publishedCourses,
				publishedPaths,
				openCohorts,
				enrollments,
				completions,
				completionRate:
					enrollments > 0
						? Math.min(100, Math.round((completions / enrollments) * 100))
						: 0,
				activeLearners7d: active7dRows.length,
				newLearners30d,
			},
			totals: this.totalsOf([...courses, ...paths, ...cohorts]),
			courses: withOwner(courses),
			paths: withOwner(paths),
			cohorts: withOwner(cohorts),
		};
	}

	// ── Per-learner drill-down ────────────────────────────────────────────────

	/**
	 * WHO is enrolled in one course/path/cohort and how far each learner has
	 * come (progress %, completed or not). Instructors are scoped to content
	 * they own; admins see everything (§2.4). Learner names are already
	 * visible to instructors in the grading queue — same disclosure level.
	 */
	/** Ownership gate shared by the drill-downs; returns the entity {id,title}. */
	private async assertOwns(
		user: AuthenticatedUser,
		type: AnalyticsEntityType,
		entityId: string,
	): Promise<{ id: string; title: string }> {
		const select = { id: true, title: true, createdBy: true } as const;
		const entity =
			type === "course"
				? await this.prisma.course.findUnique({
						where: { id: entityId },
						select,
					})
				: type === "path"
					? await this.prisma.learningPath.findUnique({
							where: { id: entityId },
							select,
						})
					: await this.prisma.cohort.findUnique({
							where: { id: entityId },
							select,
						});
		if (!entity) throw new NotFoundException("Content not found");
		if (user.role !== "admin" && entity.createdBy !== user.id) {
			throw new ForbiddenException("You do not own this content");
		}
		return { id: entity.id, title: entity.title };
	}

	async listLearners(
		user: AuthenticatedUser,
		type: AnalyticsEntityType,
		entityId: string,
	) {
		const entity = await this.assertOwns(user, type, entityId);
		const enrollments = await this.findEnrollments(type, entityId);
		const userIds = enrollments.map((e) => e.userId);
		const statuses = userIds.length
			? await this.prisma.completionStatus.findMany({
					where: {
						entityType: type,
						entityId,
						userId: { in: userIds },
					},
					select: {
						userId: true,
						progressPercent: true,
						isComplete: true,
						completedAt: true,
					},
				})
			: [];
		const statusBy = new Map(statuses.map((s) => [s.userId, s]));

		return {
			entity: { id: entity.id, title: entity.title, type },
			learners: enrollments.map((enrollment) => {
				const status = statusBy.get(enrollment.userId);
				return {
					userId: enrollment.userId,
					name: `${enrollment.user.firstName} ${enrollment.user.lastName}`.trim(),
					enrolledAt: enrollment.enrolledAt,
					progressPercent: Math.min(100, status?.progressPercent ?? 0),
					isComplete: status?.isComplete ?? false,
					completedAt: status?.completedAt ?? null,
				};
			}),
		};
	}

	/**
	 * ONE learner's performance inside ONE course/path/cohort (§2.4 per-student
	 * drill-down). Course → lesson-by-lesson (completed + post-quiz score) plus
	 * course-level assessment best scores. Path/cohort → per-component (child
	 * course/path) progress. Ownership-scoped the same as `listLearners`.
	 */
	async getLearnerDetail(
		user: AuthenticatedUser,
		type: AnalyticsEntityType,
		entityId: string,
		userId: string,
	) {
		const entity = await this.assertOwns(user, type, entityId);

		const [learner, status] = await Promise.all([
			this.prisma.user.findUnique({
				where: { id: userId },
				select: { id: true, firstName: true, lastName: true, email: true },
			}),
			this.prisma.completionStatus.findUnique({
				where: {
					userId_entityType_entityId: { userId, entityType: type, entityId },
				},
				select: {
					progressPercent: true,
					isComplete: true,
					completedAt: true,
				},
			}),
		]);
		if (!learner) throw new NotFoundException("Learner not found");

		const header = {
			userId: learner.id,
			name: `${learner.firstName} ${learner.lastName}`.trim(),
			email: learner.email,
			progressPercent: Math.min(100, status?.progressPercent ?? 0),
			isComplete: status?.isComplete ?? false,
			completedAt: status?.completedAt ?? null,
		};

		if (type === "course") {
			const [lessonRows, completions, assessments] = await Promise.all([
				this.prisma.lesson.findMany({
					where: { module: { courseId: entityId } },
					select: {
						id: true,
						title: true,
						orderIndex: true,
						module: { select: { orderIndex: true } },
					},
				}),
				this.prisma.lessonCompletion.findMany({
					where: { userId, lesson: { module: { courseId: entityId } } },
					select: {
						lessonId: true,
						completedAt: true,
						postQuizScore: true,
					},
				}),
				this.prisma.assessment.findMany({
					where: { courseId: entityId },
					select: { id: true, title: true, scope: true },
				}),
			]);
			const completionBy = new Map(completions.map((c) => [c.lessonId, c]));
			const lessons = lessonRows
				.sort(
					(a, b) =>
						(a.module?.orderIndex ?? 0) - (b.module?.orderIndex ?? 0) ||
						a.orderIndex - b.orderIndex,
				)
				.map((lesson) => {
					const done = completionBy.get(lesson.id);
					return {
						id: lesson.id,
						title: lesson.title,
						completed: done?.completedAt != null,
						postQuizScore:
							done?.postQuizScore != null ? Number(done.postQuizScore) : null,
					};
				});

			const assessmentIds = assessments.map((a) => a.id);
			const attempts = assessmentIds.length
				? await this.prisma.assessmentAttempt.findMany({
						where: {
							userId,
							assessmentId: { in: assessmentIds },
							submittedAt: { not: null },
							invalidated: false,
						},
						select: { assessmentId: true, score: true, passed: true },
					})
				: [];
			const bestBy = new Map<string, { score: number; passed: boolean }>();
			for (const a of attempts) {
				if (a.assessmentId == null) continue;
				const score = a.score != null ? Number(a.score) : 0;
				const prev = bestBy.get(a.assessmentId);
				if (!prev || score > prev.score) {
					bestBy.set(a.assessmentId, { score, passed: a.passed === true });
				}
			}
			const assessmentRows = assessments.map((assessment) => {
				const best = bestBy.get(assessment.id);
				return {
					id: assessment.id,
					title: assessment.title,
					scope: assessment.scope,
					bestScore: best?.score ?? null,
					passed: best ? best.passed : null,
				};
			});

			return {
				entity: { id: entity.id, title: entity.title, type },
				learner: header,
				lessons,
				assessments: assessmentRows,
			};
		}

		// Path / cohort → per-component (child course/path) progress.
		const components = await this.componentProgress(type, entityId, userId);
		return {
			entity: { id: entity.id, title: entity.title, type },
			learner: header,
			components,
		};
	}

	/** Child course/path progress for a learner inside a path or cohort. */
	private async componentProgress(
		type: "path" | "cohort",
		entityId: string,
		userId: string,
	) {
		const children: { id: string; title: string; type: "course" | "path" }[] =
			[];
		if (type === "path") {
			const rows = await this.prisma.pathCourse.findMany({
				where: { pathId: entityId },
				select: {
					orderIndex: true,
					course: { select: { id: true, title: true } },
				},
				orderBy: { orderIndex: "asc" },
			});
			for (const r of rows) {
				children.push({
					id: r.course.id,
					title: r.course.title,
					type: "course",
				});
			}
		} else {
			const [courses, paths] = await Promise.all([
				this.prisma.cohortCourse.findMany({
					where: { cohortId: entityId },
					select: {
						orderIndex: true,
						course: { select: { id: true, title: true } },
					},
					orderBy: { orderIndex: "asc" },
				}),
				this.prisma.cohortPath.findMany({
					where: { cohortId: entityId },
					select: {
						orderIndex: true,
						path: { select: { id: true, title: true } },
					},
					orderBy: { orderIndex: "asc" },
				}),
			]);
			for (const r of courses) {
				children.push({
					id: r.course.id,
					title: r.course.title,
					type: "course",
				});
			}
			for (const r of paths) {
				children.push({ id: r.path.id, title: r.path.title, type: "path" });
			}
		}
		if (children.length === 0) return [];

		const statuses = await this.prisma.completionStatus.findMany({
			where: {
				userId,
				OR: children.map((c) => ({ entityType: c.type, entityId: c.id })),
			},
			select: {
				entityType: true,
				entityId: true,
				progressPercent: true,
				isComplete: true,
			},
		});
		const statusBy = new Map(
			statuses.map((s) => [`${s.entityType}:${s.entityId}`, s]),
		);
		return children.map((child) => {
			const status = statusBy.get(`${child.type}:${child.id}`);
			return {
				id: child.id,
				title: child.title,
				type: child.type,
				progressPercent: Math.min(100, status?.progressPercent ?? 0),
				isComplete: status?.isComplete ?? false,
			};
		});
	}
}

/** Type guard for the controller's :entityType param. */
export function isAnalyticsEntityType(
	value: string,
): value is AnalyticsEntityType {
	return (ANALYTICS_ENTITY_TYPES as string[]).includes(value);
}
