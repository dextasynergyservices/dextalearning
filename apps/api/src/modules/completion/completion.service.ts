import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import {
	calculateCohortCompletion,
	calculateCourseCompletion,
	calculatePathCompletion,
} from "./completion.calculator";

/**
 * Completion engine (§4.3): a course is complete when all lessons are done, all
 * module assessments + the final assessment are passed, and all projects are
 * passed. Recomputes + persists `completion_status`; certificate / Earn-Back
 * payout are downstream systems that read the `isComplete` gate.
 */
@Injectable()
export class CompletionService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
	) {}

	/** The learner's started/completed courses, paths and cohorts (My Learning). */
	async getMine(user: AuthenticatedUser) {
		const [statuses, courseEnr, pathEnr, cohortEnr] = await Promise.all([
			this.prisma.completionStatus.findMany({
				where: { userId: user.id },
				orderBy: { completedAt: "asc" },
			}),
			this.prisma.courseEnrollment.findMany({
				where: { userId: user.id },
				select: { courseId: true },
			}),
			this.prisma.pathEnrollment.findMany({
				where: { userId: user.id },
				select: { pathId: true },
			}),
			this.prisma.cohortEnrollment.findMany({
				where: { userId: user.id },
				select: { cohortId: true },
			}),
		]);
		// My Learning = anything the learner enrolled in OR has progress on.
		const enrolledIds: Record<"course" | "path" | "cohort", string[]> = {
			course: courseEnr.map((e) => e.courseId),
			path: pathEnr.map((e) => e.pathId),
			cohort: cohortEnr.map((e) => e.cohortId),
		};
		const idsOf = (type: "course" | "path" | "cohort") => [
			...new Set([
				...statuses.filter((s) => s.entityType === type).map((s) => s.entityId),
				...enrolledIds[type],
			]),
		];
		const statusMap = new Map(
			statuses.map((s) => [`${s.entityType}:${s.entityId}`, s]),
		);
		// Real consumption %, persisted by the progress endpoints — 0 for an
		// enrolled-but-not-started learner (never an inflated baseline).
		const flagPercent = (s?: (typeof statuses)[number]) =>
			s?.progressPercent ?? 0;

		const commercials = {
			id: true,
			title: true,
			slug: true,
			isFree: true,
			isEarnBackEligible: true,
			earnBackPercentage: true,
		} as const;

		const [courses, paths, cohorts] = await Promise.all([
			idsOf("course").length
				? this.prisma.course.findMany({
						where: { id: { in: idsOf("course") } },
						select: { ...commercials, thumbnailKey: true },
					})
				: [],
			idsOf("path").length
				? this.prisma.learningPath.findMany({
						where: { id: { in: idsOf("path") } },
						select: { ...commercials, thumbnailKey: true },
					})
				: [],
			idsOf("cohort").length
				? this.prisma.cohort.findMany({
						where: { id: { in: idsOf("cohort") } },
						select: commercials,
					})
				: [],
		]);

		const cardOf = async (
			entity: {
				id: string;
				title: string;
				slug: string;
				isFree: boolean;
				isEarnBackEligible: boolean;
				earnBackPercentage: number | null;
				thumbnailKey?: string | null;
			},
			type: "course" | "path" | "cohort",
		) => {
			const status = statusMap.get(`${type}:${entity.id}`);
			return {
				type,
				id: entity.id,
				title: entity.title,
				slug: entity.slug,
				thumbnailUrl: entity.thumbnailKey
					? await this.storage.getSignedDownloadUrl(entity.thumbnailKey)
					: null,
				isFree: entity.isFree,
				isEarnBackEligible: entity.isEarnBackEligible,
				earnBackPercentage: entity.earnBackPercentage,
				percent: flagPercent(status),
				isComplete: status?.isComplete ?? false,
			};
		};

		return {
			courses: await Promise.all(courses.map((c) => cardOf(c, "course"))),
			paths: await Promise.all(paths.map((p) => cardOf(p, "path"))),
			cohorts: await Promise.all(
				cohorts.map((c) => cardOf({ ...c, thumbnailKey: null }, "cohort")),
			),
		};
	}

	/**
	 * Records consumption progress and lets the SYSTEM decide completion per the
	 * §4.3 criteria — there is no manual "mark complete". A lesson completes when:
	 *   • video/audio: furthest-watched ≥ `minVideoWatchPct` (default 80%), or
	 *   • text/pdf: scrolled to the end, AND
	 *   • the post-lesson quiz is passed (only if `hasPostQuiz`).
	 * Watched % is monotonic (seeking back never lowers it) and completion, once
	 * reached, is never revoked by later partial views.
	 */
	async recordLessonProgress(
		user: AuthenticatedUser,
		lessonId: string,
		input: { videoWatchedPct?: number; scrolledToEnd?: boolean },
	) {
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
			select: {
				contentType: true,
				minVideoWatchPct: true,
				hasPostQuiz: true,
				postQuizPassMark: true,
				module: { select: { courseId: true } },
			},
		});
		const courseId = lesson?.module?.courseId;
		if (!lesson || !courseId) throw new NotFoundException("Lesson not found");

		const existing = await this.prisma.lessonCompletion.findUnique({
			where: { userId_lessonId: { userId: user.id, lessonId } },
			select: {
				completedAt: true,
				videoWatchedPct: true,
				postQuizScore: true,
			},
		});

		const isReadable =
			lesson.contentType === "text" || lesson.contentType === "pdf";
		const incomingPct = input.scrolledToEnd
			? 100
			: Math.max(0, Math.min(100, input.videoWatchedPct ?? 0));
		const priorPct = existing?.videoWatchedPct
			? Number(existing.videoWatchedPct)
			: 0;
		const watchedPct = Math.max(priorPct, incomingPct);

		const threshold = isReadable ? 100 : Number(lesson.minVideoWatchPct);
		const consumptionMet = watchedPct >= threshold;

		// Post-lesson quiz gate (§4.3): blocks only when a real lesson_post quiz
		// (with questions) exists; completion needs a passed, valid attempt.
		let postQuizScore =
			existing?.postQuizScore != null ? Number(existing.postQuizScore) : null;
		let postQuizOk = !lesson.hasPostQuiz;
		if (lesson.hasPostQuiz) {
			const quiz = await this.prisma.assessment.findFirst({
				where: { lessonId, scope: "lesson_post" },
				select: { id: true, _count: { select: { questions: true } } },
			});
			if (!quiz || quiz._count.questions === 0) {
				postQuizOk = true; // flagged but no real quiz → not a gate
			} else {
				const passed = await this.prisma.assessmentAttempt.findFirst({
					where: {
						userId: user.id,
						assessmentId: quiz.id,
						passed: true,
						invalidated: false,
					},
					orderBy: { score: "desc" },
					select: { score: true },
				});
				postQuizOk = !!passed;
				if (passed?.score != null) postQuizScore = Number(passed.score);
			}
		}

		const completed = consumptionMet && postQuizOk;
		// Reflects current state. Watched % is monotonic so re-watching never
		// un-completes; this only re-opens if a post-quiz gate is added later or
		// an attempt is invalidated — in which case the lesson is correctly
		// incomplete again until re-satisfied.
		const completedAt = completed
			? (existing?.completedAt ?? new Date())
			: null;

		await this.prisma.lessonCompletion.upsert({
			where: { userId_lessonId: { userId: user.id, lessonId } },
			create: {
				userId: user.id,
				lessonId,
				videoWatchedPct: watchedPct,
				postQuizScore,
				completedAt,
			},
			update: { videoWatchedPct: watchedPct, postQuizScore, completedAt },
		});

		const course = await this.getCourseProgress(user, courseId);
		return { lessonId, watchedPct, done: completedAt != null, course };
	}

	async getCourseProgress(user: AuthenticatedUser, courseId: string) {
		const course = await this.prisma.course.findUnique({
			where: { id: courseId },
			select: {
				id: true,
				title: true,
				description: true,
				thumbnailKey: true,
				hasFinalAssessment: true,
				modules: {
					orderBy: { orderIndex: "asc" },
					select: {
						id: true,
						title: true,
						lessons: {
							orderBy: { orderIndex: "asc" },
							select: {
								id: true,
								title: true,
								contentType: true,
								minVideoWatchPct: true,
								hasPostQuiz: true,
							},
						},
					},
				},
			},
		});
		if (!course) throw new NotFoundException("Course not found");

		const moduleIds = course.modules.map((m) => m.id);
		const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));

		const [
			assessments,
			lessonPostQuizzes,
			projects,
			completions,
			passedAttempts,
			passedProjects,
		] = await Promise.all([
			this.prisma.assessment.findMany({
				where: {
					OR: [
						{ courseId, scope: "course_final" },
						{ moduleId: { in: moduleIds }, scope: "module" },
					],
				},
				select: {
					id: true,
					scope: true,
					moduleId: true,
					_count: { select: { questions: true } },
				},
			}),
			this.prisma.assessment.findMany({
				where: { lessonId: { in: lessonIds }, scope: "lesson_post" },
				select: {
					id: true,
					lessonId: true,
					_count: { select: { questions: true } },
				},
			}),
			this.prisma.project.findMany({
				where: { courseId },
				orderBy: { orderIndex: "asc" },
				select: { id: true, title: true, gradingType: true },
			}),
			this.prisma.lessonCompletion.findMany({
				where: { userId: user.id, lessonId: { in: lessonIds } },
				select: { lessonId: true, videoWatchedPct: true },
			}),
			this.prisma.assessmentAttempt.findMany({
				where: { userId: user.id, passed: true, invalidated: false },
				select: { assessmentId: true },
			}),
			this.prisma.projectSubmission.findMany({
				where: { userId: user.id, passed: true },
				select: { projectId: true },
			}),
		]);

		const passedAssessmentIds = new Set(
			passedAttempts.map((a) => a.assessmentId),
		);
		const passedProjectIds = new Set(passedProjects.map((p) => p.projectId));

		// Per-lesson watched % (furthest reached) + active post-quiz gate.
		const watchedByLesson = new Map(
			completions.map((c) => [
				c.lessonId,
				c.videoWatchedPct ? Number(c.videoWatchedPct) : 0,
			]),
		);
		const postQuizByLesson = new Map(
			lessonPostQuizzes
				.filter((a) => a._count.questions > 0)
				.map((a) => [a.lessonId as string, a.id]),
		);
		// A lesson is done when consumption is met (§4.3) AND, if a real
		// post-lesson quiz exists, it has been passed.
		const lessonState = (l: {
			id: string;
			contentType: string | null;
			minVideoWatchPct: unknown;
			hasPostQuiz: boolean;
		}) => {
			const pct = watchedByLesson.get(l.id) ?? 0;
			const readable = l.contentType === "text" || l.contentType === "pdf";
			const consumptionMet = readable
				? pct >= 100
				: pct >= Number(l.minVideoWatchPct);
			const quizId = l.hasPostQuiz ? postQuizByLesson.get(l.id) : undefined;
			const postQuizOk = !quizId || passedAssessmentIds.has(quizId);
			return { percent: Math.round(pct), done: consumptionMet && postQuizOk };
		};
		const doneLessons = new Set(
			course.modules
				.flatMap((m) => m.lessons)
				.filter((l) => lessonState(l).done)
				.map((l) => l.id),
		);

		// Only assessments that actually have questions count as required.
		const realAssessments = assessments.filter((a) => a._count.questions > 0);
		const moduleAssessmentByModule = new Map(
			realAssessments
				.filter((a) => a.scope === "module" && a.moduleId)
				.map((a) => [a.moduleId as string, a]),
		);
		const finalAssessment = realAssessments.find(
			(a) => a.scope === "course_final",
		);

		const modules = course.modules.map((m) => {
			const assessment = moduleAssessmentByModule.get(m.id);
			return {
				id: m.id,
				title: m.title,
				lessons: m.lessons.map((l) => {
					const state = lessonState(l);
					return {
						id: l.id,
						title: l.title,
						contentType: l.contentType,
						done: state.done,
						percent: state.percent,
					};
				}),
				assessment: assessment
					? {
							id: assessment.id,
							passed: passedAssessmentIds.has(assessment.id),
						}
					: null,
			};
		});

		const projectRows = projects.map((p) => ({
			id: p.id,
			title: p.title,
			gradingType: p.gradingType,
			passed: passedProjectIds.has(p.id),
		}));

		// ── Completion criteria (§4.3) — pure math in completion.calculator.ts ──
		const lessonsDone = doneLessons.size;
		const lessonsTotal = lessonIds.length;

		const moduleAssessments = [...moduleAssessmentByModule.values()];
		const allModuleAssessmentsPassed = moduleAssessments.every((a) =>
			passedAssessmentIds.has(a.id),
		);

		const finalRequired = course.hasFinalAssessment && !!finalAssessment;
		const finalAssessmentPassed =
			!finalRequired ||
			(finalAssessment ? passedAssessmentIds.has(finalAssessment.id) : true);

		const allProjectsPassed = projectRows.every((p) => p.passed);

		const { allLessonsDone, isComplete, percent } = calculateCourseCompletion({
			lessonsDone,
			lessonsTotal,
			moduleAssessmentsCount: moduleAssessments.length,
			allModuleAssessmentsPassed,
			finalRequired,
			finalAssessmentPassed,
			projectsCount: projectRows.length,
			allProjectsPassed,
		});

		await this.persistCompletion(user.id, "course", courseId, {
			allLessonsDone,
			allModuleAssessmentsPassed,
			finalAssessmentPassed,
			allProjectsPassed,
			isComplete,
			percent,
		});

		return {
			course: {
				id: course.id,
				title: course.title,
				description: course.description,
				thumbnailUrl: course.thumbnailKey
					? await this.storage.getSignedDownloadUrl(course.thumbnailKey)
					: null,
			},
			modules,
			projects: projectRows,
			finalAssessment: finalAssessment
				? {
						id: finalAssessment.id,
						passed: passedAssessmentIds.has(finalAssessment.id),
						required: finalRequired,
					}
				: null,
			summary: {
				lessonsDone,
				lessonsTotal,
				allLessonsDone,
				allModuleAssessmentsPassed,
				finalAssessmentPassed,
				allProjectsPassed,
				isComplete,
				percent,
			},
		};
	}

	private async persistCompletion(
		userId: string,
		entityType: "course" | "path" | "cohort",
		entityId: string,
		flags: {
			allLessonsDone: boolean;
			allModuleAssessmentsPassed: boolean;
			finalAssessmentPassed: boolean;
			allProjectsPassed: boolean;
			isComplete: boolean;
			percent: number;
		},
	) {
		const key = {
			userId_entityType_entityId: { userId, entityType, entityId },
		};
		const existing = await this.prisma.completionStatus.findUnique({
			where: key,
			select: { completedAt: true },
		});
		const { percent, ...rest } = flags;
		const completedAt = rest.isComplete
			? (existing?.completedAt ?? new Date())
			: null;
		await this.prisma.completionStatus.upsert({
			where: key,
			create: {
				userId,
				entityType,
				entityId,
				...rest,
				progressPercent: percent,
				completedAt,
			},
			update: { ...rest, progressPercent: percent, completedAt },
		});
	}

	// ── Path completion (§4.1): all required courses complete ─────────────────
	async getPathProgress(user: AuthenticatedUser, pathId: string) {
		const path = await this.prisma.learningPath.findUnique({
			where: { id: pathId },
			select: {
				id: true,
				title: true,
				pathCourses: {
					orderBy: { orderIndex: "asc" },
					select: {
						courseId: true,
						isRequired: true,
						course: { select: { id: true, title: true } },
					},
				},
			},
		});
		if (!path) throw new NotFoundException("Path not found");

		const courses: {
			id: string;
			title: string;
			isRequired: boolean;
			isComplete: boolean;
			percent: number;
		}[] = [];
		for (const pc of path.pathCourses) {
			const cp = await this.getCourseProgress(user, pc.courseId);
			courses.push({
				id: pc.courseId,
				title: pc.course?.title ?? "",
				isRequired: pc.isRequired,
				isComplete: cp.summary.isComplete,
				percent: cp.summary.percent,
			});
		}
		const { isComplete, percent } = calculatePathCompletion(courses);

		await this.persistCompletion(user.id, "path", pathId, {
			allLessonsDone: isComplete,
			allModuleAssessmentsPassed: isComplete,
			finalAssessmentPassed: isComplete,
			allProjectsPassed: isComplete,
			isComplete,
			percent,
		});

		return {
			path: { id: path.id, title: path.title },
			courses,
			summary: {
				coursesTotal: courses.length,
				coursesComplete: courses.filter((c) => c.isComplete).length,
				isComplete,
				percent,
			},
		};
	}

	// ── Cohort completion: all cohort courses + cohort assessments/projects ───
	async getCohortProgress(user: AuthenticatedUser, cohortId: string) {
		const cohort = await this.prisma.cohort.findUnique({
			where: { id: cohortId },
			select: {
				id: true,
				title: true,
				courses: {
					orderBy: { orderIndex: "asc" },
					select: { courseId: true, course: { select: { title: true } } },
				},
				paths: {
					orderBy: { orderIndex: "asc" },
					select: { pathId: true, path: { select: { title: true } } },
				},
			},
		});
		if (!cohort) throw new NotFoundException("Cohort not found");

		const courses: {
			id: string;
			title: string;
			isComplete: boolean;
			percent: number;
		}[] = [];
		for (const cc of cohort.courses) {
			const cp = await this.getCourseProgress(user, cc.courseId);
			courses.push({
				id: cc.courseId,
				title: cc.course?.title ?? "",
				isComplete: cp.summary.isComplete,
				percent: cp.summary.percent,
			});
		}

		const paths: {
			id: string;
			title: string;
			isComplete: boolean;
			percent: number;
		}[] = [];
		for (const cp of cohort.paths) {
			const pp = await this.getPathProgress(user, cp.pathId);
			paths.push({
				id: cp.pathId,
				title: cp.path?.title ?? "",
				isComplete: pp.summary.isComplete,
				percent: pp.summary.percent,
			});
		}

		const [assessments, projects, passedAttempts, passedProjects] =
			await Promise.all([
				this.prisma.assessment.findMany({
					where: { cohortId, scope: "cohort" },
					select: {
						id: true,
						title: true,
						_count: { select: { questions: true } },
					},
				}),
				this.prisma.project.findMany({
					where: { cohortId },
					orderBy: { orderIndex: "asc" },
					select: { id: true, title: true, gradingType: true },
				}),
				this.prisma.assessmentAttempt.findMany({
					where: { userId: user.id, passed: true, invalidated: false },
					select: { assessmentId: true },
				}),
				this.prisma.projectSubmission.findMany({
					where: { userId: user.id, passed: true },
					select: { projectId: true },
				}),
			]);
		const passedAssessmentIds = new Set(
			passedAttempts.map((a) => a.assessmentId),
		);
		const passedProjectIds = new Set(passedProjects.map((p) => p.projectId));

		const realAssessments = assessments.filter((a) => a._count.questions > 0);
		const assessmentRows = realAssessments.map((a) => ({
			id: a.id,
			title: a.title,
			passed: passedAssessmentIds.has(a.id),
		}));
		const projectRows = projects.map((p) => ({
			id: p.id,
			title: p.title,
			gradingType: p.gradingType,
			passed: passedProjectIds.has(p.id),
		}));

		const allAssessmentsPassed = assessmentRows.every((a) => a.passed);
		const allProjectsPassed = projectRows.every((p) => p.passed);

		const { allCoursesComplete, allPathsComplete, isComplete, percent } =
			calculateCohortCompletion({
				courses,
				paths,
				assessmentsCount: assessmentRows.length,
				allAssessmentsPassed,
				projectsCount: projectRows.length,
				allProjectsPassed,
			});

		await this.persistCompletion(user.id, "cohort", cohortId, {
			allLessonsDone: allCoursesComplete && allPathsComplete,
			allModuleAssessmentsPassed: allAssessmentsPassed,
			finalAssessmentPassed: allAssessmentsPassed,
			allProjectsPassed,
			isComplete,
			percent,
		});

		return {
			cohort: { id: cohort.id, title: cohort.title },
			courses,
			paths,
			assessments: assessmentRows,
			projects: projectRows,
			summary: {
				coursesComplete: courses.filter((c) => c.isComplete).length,
				coursesTotal: courses.length,
				pathsComplete: paths.filter((p) => p.isComplete).length,
				pathsTotal: paths.length,
				allAssessmentsPassed,
				allProjectsPassed,
				isComplete,
				percent,
			},
		};
	}

	// ── Lesson player context (course + prev/next navigation) ─────────────────
	async getLessonContext(user: AuthenticatedUser, lessonId: string) {
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
			select: {
				id: true,
				title: true,
				contentType: true,
				minVideoWatchPct: true,
				hasPreQuiz: true,
				hasPostQuiz: true,
				module: { select: { courseId: true } },
			},
		});
		const courseId = lesson?.module?.courseId;
		if (!lesson || !courseId) throw new NotFoundException("Lesson not found");

		const [course, ordered, mine, quizzes] = await Promise.all([
			this.prisma.course.findUnique({
				where: { id: courseId },
				select: { id: true, title: true },
			}),
			this.prisma.lesson.findMany({
				where: { module: { courseId } },
				orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
				select: {
					id: true,
					title: true,
					contentType: true,
					module: { select: { title: true } },
				},
			}),
			this.prisma.lessonCompletion.findUnique({
				where: { userId_lessonId: { userId: user.id, lessonId } },
				select: { videoWatchedPct: true, completedAt: true },
			}),
			this.prisma.assessment.findMany({
				where: { lessonId, scope: { in: ["lesson_pre", "lesson_post"] } },
				select: {
					id: true,
					scope: true,
					_count: { select: { questions: true } },
				},
			}),
		]);
		const ids = ordered.map((l) => l.id);
		const completed = new Set(
			(
				await this.prisma.lessonCompletion.findMany({
					where: {
						userId: user.id,
						lessonId: { in: ids },
						completedAt: { not: null },
					},
					select: { lessonId: true },
				})
			).map((c) => c.lessonId),
		);

		// Pre/post lesson quizzes (real ones, with questions) + pass state (§8.2).
		const activeQuizzes = quizzes.filter((q) => q._count.questions > 0);
		const quizIds = activeQuizzes.map((q) => q.id);
		const passedQuizIds = quizIds.length
			? new Set(
					(
						await this.prisma.assessmentAttempt.findMany({
							where: {
								userId: user.id,
								assessmentId: { in: quizIds },
								passed: true,
								invalidated: false,
							},
							select: { assessmentId: true },
						})
					).map((a) => a.assessmentId),
				)
			: new Set<string>();
		const quizOf = (scope: "lesson_pre" | "lesson_post") => {
			const q = activeQuizzes.find((x) => x.scope === scope);
			return q ? { id: q.id, passed: passedQuizIds.has(q.id) } : null;
		};
		const postQuiz = quizOf("lesson_post");

		// Live completion for THIS lesson (consumption + post-quiz), so the player
		// never disagrees with the course hub (§4.3).
		const watchedPct = mine?.videoWatchedPct ? Number(mine.videoWatchedPct) : 0;
		const isReadable =
			lesson.contentType === "text" || lesson.contentType === "pdf";
		const consumptionMet = isReadable
			? watchedPct >= 100
			: watchedPct >= Number(lesson.minVideoWatchPct);
		const liveDone = consumptionMet && (!postQuiz || postQuiz.passed);

		const index = ids.indexOf(lessonId);
		const lessons = ordered.map((l) => ({
			id: l.id,
			title: l.title,
			contentType: l.contentType,
			moduleTitle: l.module?.title ?? "",
			done: completed.has(l.id),
		}));
		return {
			lesson: {
				id: lesson.id,
				title: lesson.title,
				contentType: lesson.contentType,
				minVideoWatchPct: Number(lesson.minVideoWatchPct),
				hasPreQuiz: lesson.hasPreQuiz,
				hasPostQuiz: lesson.hasPostQuiz,
			},
			course: { id: courseId, title: course?.title ?? "" },
			lessons,
			preQuiz: quizOf("lesson_pre"),
			postQuiz,
			resumePct: watchedPct,
			prevLessonId: index > 0 ? ids[index - 1] : null,
			nextLessonId: index < ids.length - 1 ? ids[index + 1] : null,
			position: { index: index + 1, total: ids.length },
			done: liveDone,
		};
	}
}
