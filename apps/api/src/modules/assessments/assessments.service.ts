import {
	BadGatewayException,
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { renderNotificationEmail } from "../../emails/render";
import { PrismaService } from "../../prisma/prisma.service";
import {
	AI_PORT,
	type AiPort,
	type GeneratedQuestionType,
	type QuizMedia,
} from "../../shared/ai/ai.port";
import {
	MEDIA_ENCODER_PORT,
	type MediaEncoderPort,
} from "../../shared/encoding/media-encoder.port";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import { NotificationsService } from "../notifications/notifications.service";
import { isFinalAssessmentScope } from "./assessment-scopes";
import type {
	AssessmentScopeDto,
	CreateAssessmentDto,
	CreateQuestionDto,
	UpdateAssessmentDto,
	UpdateQuestionDto,
} from "./dto/assessments.dto";

interface ParentRef {
	lessonId?: string;
	moduleId?: string;
	courseId?: string;
	pathId?: string;
	cohortId?: string;
}

const SCOPE_PARENT_KEY: Record<AssessmentScopeDto, keyof ParentRef> = {
	lesson_pre: "lessonId",
	lesson_post: "lessonId",
	module: "moduleId",
	course_final: "courseId",
	path_final: "pathId",
	cohort: "cohortId",
};

/**
 * Ceiling on the prose sent to the quiz generator. A course-final assessment can
 * legitimately span dozens of transcripts; without a cap the request cost grows
 * with the course. Trimmed at a paragraph break so we never cut mid-sentence.
 */
const MAX_SOURCE_CHARS = 40_000;

function truncateSource(text: string): string {
	if (text.length <= MAX_SOURCE_CHARS) return text;
	const cut = text.slice(0, MAX_SOURCE_CHARS);
	const lastBreak = cut.lastIndexOf("\n\n");
	return lastBreak > MAX_SOURCE_CHARS * 0.5 ? cut.slice(0, lastBreak) : cut;
}

/** Assessment + question authoring (§4.4). Instructor/admin owned. */
@Injectable()
export class AssessmentsService {
	private readonly logger = new Logger(AssessmentsService.name);

	constructor(
		private readonly prisma: PrismaService,
		@Inject(AI_PORT) private readonly ai: AiPort,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
		@Inject(MEDIA_ENCODER_PORT) private readonly encoder: MediaEncoderPort,
		private readonly notifications: NotificationsService,
	) {}

	/**
	 * Authorisation: resolve the parent to its owning course/path creator (or
	 * gate cohort-scoped assessments to admins) and verify the caller may manage
	 * it. Admins can manage anything.
	 */
	private async assertCanManage(user: AuthenticatedUser, parent: ParentRef) {
		if (parent.cohortId) {
			if (user.role !== "admin") {
				throw new ForbiddenException("Cohort assessments are admin-only");
			}
			const cohort = await this.prisma.cohort.findUnique({
				where: { id: parent.cohortId },
				select: { id: true },
			});
			if (!cohort) throw new NotFoundException("Cohort not found");
			return;
		}

		let createdBy: string | null = null;
		if (parent.courseId) {
			const course = await this.prisma.course.findUnique({
				where: { id: parent.courseId },
				select: { createdBy: true },
			});
			if (!course) throw new NotFoundException("Course not found");
			createdBy = course.createdBy;
		} else if (parent.moduleId) {
			const mod = await this.prisma.module.findUnique({
				where: { id: parent.moduleId },
				select: { course: { select: { createdBy: true } } },
			});
			if (!mod) throw new NotFoundException("Module not found");
			createdBy = mod.course?.createdBy ?? null;
		} else if (parent.lessonId) {
			const lesson = await this.prisma.lesson.findUnique({
				where: { id: parent.lessonId },
				select: {
					module: { select: { course: { select: { createdBy: true } } } },
				},
			});
			if (!lesson) throw new NotFoundException("Lesson not found");
			createdBy = lesson.module?.course?.createdBy ?? null;
		} else if (parent.pathId) {
			const path = await this.prisma.learningPath.findUnique({
				where: { id: parent.pathId },
				select: { createdBy: true },
			});
			if (!path) throw new NotFoundException("Path not found");
			createdBy = path.createdBy;
		} else {
			throw new BadRequestException("No parent specified for the assessment");
		}

		if (user.role === "admin" || createdBy === user.id) return;
		throw new ForbiddenException("You do not own this content");
	}

	private async loadOwnedAssessment(user: AuthenticatedUser, id: string) {
		const assessment = await this.prisma.assessment.findUnique({
			where: { id },
		});
		if (!assessment) throw new NotFoundException("Assessment not found");
		await this.assertCanManage(user, {
			lessonId: assessment.lessonId ?? undefined,
			moduleId: assessment.moduleId ?? undefined,
			courseId: assessment.courseId ?? undefined,
			pathId: assessment.pathId ?? undefined,
			cohortId: assessment.cohortId ?? undefined,
		});
		return assessment;
	}

	private scopeParent(dto: CreateAssessmentDto): ParentRef {
		const key = SCOPE_PARENT_KEY[dto.scope];
		const id = dto[key];
		if (!id) {
			throw new BadRequestException(
				`${key} is required for scope "${dto.scope}"`,
			);
		}
		return { [key]: id };
	}

	/**
	 * The academy an assessment/project belongs to: its parent's (§2.1). It is
	 * never independently chosen — everything under a Tech course is Tech.
	 */
	private async parentTenantId(parent: ParentRef): Promise<string | null> {
		if (parent.courseId) {
			return (
				(
					await this.prisma.course.findUnique({
						where: { id: parent.courseId },
						select: { tenantId: true },
					})
				)?.tenantId ?? null
			);
		}
		if (parent.pathId) {
			return (
				(
					await this.prisma.learningPath.findUnique({
						where: { id: parent.pathId },
						select: { tenantId: true },
					})
				)?.tenantId ?? null
			);
		}
		if (parent.cohortId) {
			return (
				(
					await this.prisma.cohort.findUnique({
						where: { id: parent.cohortId },
						select: { tenantId: true },
					})
				)?.tenantId ?? null
			);
		}
		if (parent.moduleId) {
			return (
				(
					await this.prisma.module.findUnique({
						where: { id: parent.moduleId },
						select: { course: { select: { tenantId: true } } },
					})
				)?.course?.tenantId ?? null
			);
		}
		if (parent.lessonId) {
			const l = await this.prisma.lesson.findUnique({
				where: { id: parent.lessonId },
				select: {
					module: { select: { course: { select: { tenantId: true } } } },
					introForPath: { select: { tenantId: true } },
					introForCohort: { select: { tenantId: true } },
				},
			});
			return (
				l?.module?.course?.tenantId ??
				l?.introForPath?.tenantId ??
				l?.introForCohort?.tenantId ??
				null
			);
		}
		return null;
	}

	// ── Assessments ─────────────────────────────────────────────────────────
	async createAssessment(user: AuthenticatedUser, dto: CreateAssessmentDto) {
		const parent = this.scopeParent(dto);
		await this.assertCanManage(user, parent);
		return this.prisma.assessment.create({
			data: {
				scope: dto.scope,
				type: dto.type ?? "quiz",
				title: dto.title,
				...parent,
				tenantId: await this.parentTenantId(parent),
				createdBy: user.id,
			},
		});
	}

	/** List assessments attached to a given parent (course/module/lesson/path/cohort). */
	async listForParent(user: AuthenticatedUser, parent: ParentRef) {
		if (!Object.values(parent).some(Boolean)) {
			throw new BadRequestException(
				"Provide one parent id to list assessments",
			);
		}
		await this.assertCanManage(user, parent);
		return this.prisma.assessment.findMany({
			where: {
				lessonId: parent.lessonId ?? undefined,
				moduleId: parent.moduleId ?? undefined,
				courseId: parent.courseId ?? undefined,
				pathId: parent.pathId ?? undefined,
				cohortId: parent.cohortId ?? undefined,
			},
			orderBy: { createdAt: "asc" },
			include: { _count: { select: { questions: true } } },
		});
	}

	async getForEdit(user: AuthenticatedUser, id: string) {
		const owned = await this.loadOwnedAssessment(user, id);
		const assessment = await this.prisma.assessment.findUnique({
			where: { id },
			include: { questions: { orderBy: { orderIndex: "asc" } } },
		});
		// Code questions keep {language, starterCode} in optionsJson; surface it as
		// a typed `codeConfig` and keep `optionsJson` as the MCQ options array only,
		// so the editor never confuses the two shapes.
		const questions = (assessment?.questions ?? []).map((q) => {
			const codeConfig =
				q.type === "code" && q.optionsJson && !Array.isArray(q.optionsJson)
					? (q.optionsJson as { language: string; starterCode?: string })
					: null;
			return {
				...q,
				optionsJson: codeConfig ? null : q.optionsJson,
				codeConfig,
			};
		});
		// Candidate lessons across the assessment's whole scope, for the AI
		// generator's multi-select picker (§4.4).
		const sourceLessons = await this.resolveSourceLessons(owned);
		return { ...assessment, questions, sourceLessons };
	}

	/**
	 * Every course in the assessment's scope. A course/module/lesson-scoped
	 * assessment resolves to its own course; a path-final spans the path's
	 * courses; a cohort-final spans the cohort's courses *and* the courses of
	 * any path the cohort carries. These are documented analytical reads across
	 * the link tables (§6.4) — the generator needs the full picture to draw on.
	 */
	private async resolveScopeCourseIds(a: {
		courseId: string | null;
		moduleId: string | null;
		lessonId: string | null;
		pathId: string | null;
		cohortId: string | null;
	}): Promise<string[]> {
		if (a.courseId) return [a.courseId];
		if (a.moduleId) {
			const mod = await this.prisma.module.findUnique({
				where: { id: a.moduleId },
				select: { courseId: true },
			});
			return mod?.courseId ? [mod.courseId] : [];
		}
		if (a.lessonId) {
			const lesson = await this.prisma.lesson.findUnique({
				where: { id: a.lessonId },
				select: { module: { select: { courseId: true } } },
			});
			return lesson?.module?.courseId ? [lesson.module.courseId] : [];
		}
		if (a.pathId) {
			const links = await this.prisma.pathCourse.findMany({
				where: { pathId: a.pathId },
				select: { courseId: true },
				orderBy: { orderIndex: "asc" },
			});
			return links.map((l) => l.courseId).filter((id): id is string => !!id);
		}
		if (a.cohortId) {
			const [direct, viaPaths] = await Promise.all([
				this.prisma.cohortCourse.findMany({
					where: { cohortId: a.cohortId },
					select: { courseId: true },
					orderBy: { orderIndex: "asc" },
				}),
				this.prisma.cohortPath.findMany({
					where: { cohortId: a.cohortId },
					select: {
						path: {
							select: {
								pathCourses: {
									select: { courseId: true },
									orderBy: { orderIndex: "asc" },
								},
							},
						},
					},
				}),
			]);
			const ids = [
				...direct.map((c) => c.courseId),
				...viaPaths.flatMap((cp) =>
					(cp.path?.pathCourses ?? []).map((pc) => pc.courseId),
				),
			].filter((id): id is string => !!id);
			return [...new Set(ids)];
		}
		return [];
	}

	/**
	 * Candidate source lessons for AI question generation, grouped by course +
	 * module so the picker can offer "select all in this module / course".
	 */
	private async resolveSourceLessons(a: {
		courseId: string | null;
		moduleId: string | null;
		lessonId: string | null;
		pathId: string | null;
		cohortId: string | null;
	}) {
		const courseIds = await this.resolveScopeCourseIds(a);
		if (courseIds.length === 0) return [];
		const lessons = await this.prisma.lesson.findMany({
			where: { module: { courseId: { in: courseIds } } },
			select: {
				id: true,
				title: true,
				contentType: true,
				transcriptText: true,
				contentText: true,
				audioKey: true,
				pdfKey: true,
				videoKeysJson: true,
				module: {
					select: {
						id: true,
						title: true,
						orderIndex: true,
						course: { select: { id: true, title: true } },
					},
				},
			},
			orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
		});
		return lessons.map((l) => {
			const hasText =
				(l.transcriptText ?? "").trim().length > 0 ||
				(l.contentText ?? "").replace(/<[^>]+>/g, "").trim().length > 0;
			// Media is a valid (costlier) source too — §4.10 fallback.
			const hasMedia =
				(l.contentType === "pdf" && !!l.pdfKey) ||
				(l.contentType === "audio" && !!l.audioKey) ||
				(l.contentType === "video" && !!l.videoKeysJson);
			return {
				id: l.id,
				title: l.title ?? "Untitled lesson",
				// Generatable when there's any usable source: text OR media.
				hasTranscript: hasText || hasMedia,
				moduleId: l.module?.id ?? null,
				moduleTitle: l.module?.title ?? null,
				courseId: l.module?.course?.id ?? null,
				courseTitle: l.module?.course?.title ?? null,
			};
		});
	}

	async updateAssessment(
		user: AuthenticatedUser,
		id: string,
		dto: UpdateAssessmentDto,
	) {
		const owned = await this.loadOwnedAssessment(user, id);
		// Retry rules belong to finals only (§4.4.1) — a formative lesson/module
		// quiz is practice and stays unlimited. Clearing (null) is always fine.
		if (!isFinalAssessmentScope(owned.scope)) {
			const offending = (
				["maxRetakes", "retakeCooldownHours", "retakeLockoutDays"] as const
			).filter((k) => dto[k] != null);
			if (offending.length > 0) {
				throw new BadRequestException({
					code: "RETRY_POLICY_FINALS_ONLY",
					message:
						"Retry rules apply to final assessments only — lesson and module quizzes are unlimited practice.",
					details: { fields: offending, scope: owned.scope },
				});
			}
		}
		const { scheduledAt, dueAt, ...rest } = dto;
		return this.prisma.assessment.update({
			where: { id },
			data: {
				...rest,
				...(scheduledAt !== undefined
					? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
					: {}),
				...(dueAt !== undefined
					? { dueAt: dueAt ? new Date(dueAt) : null }
					: {}),
			},
		});
	}

	async deleteAssessment(user: AuthenticatedUser, id: string) {
		await this.loadOwnedAssessment(user, id);
		await this.prisma.assessment.delete({ where: { id } });
		return { deleted: true };
	}

	// ── Questions ───────────────────────────────────────────────────────────
	async addQuestion(
		user: AuthenticatedUser,
		assessmentId: string,
		dto: CreateQuestionDto,
	) {
		await this.loadOwnedAssessment(user, assessmentId);
		const last = await this.prisma.question.aggregate({
			where: { assessmentId },
			_max: { orderIndex: true },
		});
		return this.prisma.question.create({
			data: {
				assessmentId,
				type: dto.type,
				body: dto.body,
				// A code question stores its {language, starterCode} in optionsJson;
				// MCQ stores its options there. They never coexist (type decides).
				optionsJson:
					dto.type === "code"
						? dto.codeConfig
							? { ...dto.codeConfig }
							: undefined
						: (dto.options ?? undefined),
				correctAnswer: dto.correctAnswer,
				points: dto.points ?? 1,
				orderIndex: (last._max.orderIndex ?? 0) + 1,
			},
		});
	}

	private async loadOwnedQuestion(user: AuthenticatedUser, questionId: string) {
		const question = await this.prisma.question.findUnique({
			where: { id: questionId },
			select: { id: true, assessmentId: true },
		});
		if (!question?.assessmentId) {
			throw new NotFoundException("Question not found");
		}
		await this.loadOwnedAssessment(user, question.assessmentId);
		return question;
	}

	async updateQuestion(
		user: AuthenticatedUser,
		questionId: string,
		dto: UpdateQuestionDto,
	) {
		await this.loadOwnedQuestion(user, questionId);
		const { options, codeConfig, ...rest } = dto;
		return this.prisma.question.update({
			where: { id: questionId },
			data: {
				...rest,
				// Code config and MCQ options share optionsJson; whichever the edit
				// carries wins (Prisma Json wants a plain object, not the DTO class).
				...(codeConfig !== undefined
					? { optionsJson: { ...codeConfig } }
					: options !== undefined
						? { optionsJson: options }
						: {}),
			},
		});
	}

	async deleteQuestion(user: AuthenticatedUser, questionId: string) {
		await this.loadOwnedQuestion(user, questionId);
		await this.prisma.question.delete({ where: { id: questionId } });
		return { deleted: true };
	}

	async reorderQuestions(
		user: AuthenticatedUser,
		assessmentId: string,
		questionIds: string[],
	) {
		await this.loadOwnedAssessment(user, assessmentId);
		await this.prisma.$transaction(
			questionIds.map((id, index) =>
				this.prisma.question.update({
					where: { id },
					data: { orderIndex: index + 1 },
				}),
			),
		);
		return { reordered: true };
	}

	/**
	 * AI quiz generation (§4.10 — instructor-triggered): generate questions from a
	 * lesson transcript via the AI port (Gemini) and append them to the
	 * assessment. The instructor reviews/edits the drafts afterwards.
	 */
	/**
	 * Fallback source for quiz-gen when a lesson has no usable text (§4.10):
	 * PDF inline, audio inline, video as its extracted audio track (speech only —
	 * far cheaper than video frames). Returns null when nothing readable exists
	 * or the media is too large for an inline request.
	 */
	private async resolveLessonMedia(lesson: {
		contentType: string | null;
		audioKey: string | null;
		pdfKey: string | null;
		videoKeysJson: unknown;
	}): Promise<QuizMedia | null> {
		const MAX_INLINE = 18 * 1024 * 1024;
		const within = (data: Buffer, mimeType: string): QuizMedia | null =>
			data.length <= MAX_INLINE ? { mimeType, data } : null;
		try {
			if (lesson.contentType === "pdf" && lesson.pdfKey) {
				const data = await this.storage.getObject(lesson.pdfKey);
				return within(data, "application/pdf");
			}
			if (lesson.contentType === "audio" && lesson.audioKey) {
				const raw = await this.storage.getObject(lesson.audioKey);
				return within(
					await this.encoder.extractAudioForAi(raw, "m4a"),
					"audio/mp3",
				);
			}
			if (lesson.contentType === "video" && lesson.videoKeysJson) {
				const keys = lesson.videoKeysJson as Record<string, string>;
				const key = keys["144p"] ?? keys["240p"] ?? Object.values(keys)[0];
				if (!key) return null;
				const raw = await this.storage.getObject(key);
				return within(
					await this.encoder.extractAudioForAi(raw, "mp4"),
					"audio/mp3",
				);
			}
		} catch {
			return null; // unreadable media → caller surfaces NO_SOURCE
		}
		return null;
	}

	async generateQuestions(
		user: AuthenticatedUser,
		assessmentId: string,
		dto: {
			lessonId?: string;
			lessonIds?: string[];
			count?: number;
			types?: GeneratedQuestionType[];
		},
	) {
		const assessment = await this.loadOwnedAssessment(user, assessmentId);
		// Multi-select is the modern path; a single `lessonId` (and the
		// assessment's own lesson) stay supported for lesson-scoped quizzes.
		const requested = [
			...(dto.lessonIds ?? []),
			...(dto.lessonId ? [dto.lessonId] : []),
			...(dto.lessonIds?.length || dto.lessonId
				? []
				: assessment.lessonId
					? [assessment.lessonId]
					: []),
		];
		const lessonIds = [...new Set(requested)];
		if (lessonIds.length === 0) {
			throw new BadRequestException({
				code: "LESSON_REQUIRED",
				message: "Choose at least one lesson to generate questions from.",
			});
		}
		// Only lessons inside this assessment's own scope may seed it (§6.4) —
		// otherwise a course quiz could be built from someone else's content.
		const allowedCourseIds = await this.resolveScopeCourseIds(assessment);
		const lessons = await this.prisma.lesson.findMany({
			where: {
				id: { in: lessonIds },
				...(allowedCourseIds.length > 0
					? { module: { courseId: { in: allowedCourseIds } } }
					: {}),
			},
			select: {
				id: true,
				title: true,
				contentType: true,
				transcriptText: true,
				contentText: true,
				audioKey: true,
				pdfKey: true,
				videoKeysJson: true,
				module: { select: { orderIndex: true } },
				orderIndex: true,
			},
			orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
		});
		if (lessons.length === 0) {
			throw new NotFoundException(
				"None of the chosen lessons are available for this assessment.",
			);
		}

		// Cheapest-first source: the instructor transcript plus, for text lessons,
		// the lesson's own rich-text content (its content IS the transcript, §4.2).
		// HTML tags stripped so we send clean prose, not markup. Each lesson is
		// labelled so the model can spread questions across the material rather
		// than reading it as one undifferentiated wall of text.
		const sections = lessons
			.map((l) => {
				const transcript = (l.transcriptText ?? "").trim();
				const richText = (l.contentText ?? "")
					.replace(/<[^>]+>/g, " ")
					.replace(/&nbsp;/g, " ")
					.replace(/\s+/g, " ")
					.trim();
				const body = [transcript, richText].filter(Boolean).join("\n\n");
				return body ? `## ${l.title ?? "Untitled lesson"}\n${body}` : "";
			})
			.filter(Boolean);
		const sourceText = truncateSource(sections.join("\n\n"));

		// No usable text → fall back to the lesson media itself (§4.10): PDF or
		// audio inline, video as its extracted audio track (cheap, speech-only).
		// Only for a single lesson: sending several videos would be needlessly
		// expensive, and the fix (add transcripts) is the one we want to nudge.
		let media: QuizMedia | null = null;
		if (sourceText.length < 40) {
			media =
				lessons.length === 1 ? await this.resolveLessonMedia(lessons[0]) : null;
			if (!media) {
				throw new BadRequestException({
					code: "NO_SOURCE",
					message:
						lessons.length === 1
							? "This lesson has no transcript, text, or readable media yet — add a transcript or content to generate questions from it."
							: "None of the chosen lessons have a transcript or text yet. Add transcripts, or pick a single lesson to generate from its media.",
				});
			}
		}

		const types =
			dto.types && dto.types.length > 0
				? dto.types
				: (["mcq", "true_false", "short_answer"] as GeneratedQuestionType[]);
		const count = Math.min(20, Math.max(1, dto.count ?? 5));

		const generated = await this.ai.generateQuizQuestions({
			sourceText: media ? undefined : sourceText,
			media: media ?? undefined,
			count,
			types,
			context:
				lessons.length === 1
					? (lessons[0].title ?? undefined)
					: `${assessment.title ?? "Assessment"} — covering: ${lessons
							.map((l) => l.title ?? "Untitled lesson")
							.join(", ")}`,
		});
		if (generated.length === 0) {
			throw new BadGatewayException({
				code: "AI_NO_QUESTIONS",
				message: "The AI returned no usable questions. Try again.",
			});
		}

		const last = await this.prisma.question.aggregate({
			where: { assessmentId },
			_max: { orderIndex: true },
		});
		let order = last._max.orderIndex ?? 0;
		await this.prisma.$transaction(
			generated.map((q) => {
				order += 1;
				return this.prisma.question.create({
					data: {
						assessmentId,
						type: q.type,
						body: q.body,
						optionsJson: q.options ?? undefined,
						correctAnswer: q.correctAnswer,
						points: q.points ?? 1,
						orderIndex: order,
					},
				});
			}),
		);

		return this.prisma.question.findMany({
			where: { assessmentId },
			orderBy: { orderIndex: "asc" },
		});
	}

	// ── Anti-cheat reporting (§4.6.4 — instructor/admin) ──────────────────────
	private async loadManagedAttempt(user: AuthenticatedUser, attemptId: string) {
		const attempt = await this.prisma.assessmentAttempt.findUnique({
			where: { id: attemptId },
		});
		if (!attempt) throw new NotFoundException("Attempt not found");
		if (attempt.assessmentId) {
			// Reuses the authoring ownership check: the caller must manage the parent.
			await this.loadOwnedAssessment(user, attempt.assessmentId);
		} else if (user.role !== "admin") {
			// Orphaned attempt (its assessment was deleted → `assessmentId` set null).
			// No owner to check, so only Admin may review the surviving integrity
			// record; instructors can't lay claim to a null-parent attempt.
			throw new ForbiddenException("You do not own this content");
		}
		return attempt;
	}

	/** Attempts for an assessment, most-suspicious first (lowest integrity). */
	async listAttempts(user: AuthenticatedUser, assessmentId: string) {
		await this.loadOwnedAssessment(user, assessmentId);
		const attempts = await this.prisma.assessmentAttempt.findMany({
			where: { assessmentId, submittedAt: { not: null } },
			include: { user: { select: { name: true, email: true } } },
			orderBy: [{ integrityScore: "asc" }, { submittedAt: "desc" }],
		});
		return attempts.map((a) => ({
			id: a.id,
			attemptNumber: a.attemptNumber,
			userName: a.user?.name ?? null,
			userEmail: a.user?.email ?? null,
			submittedAt: a.submittedAt,
			score: a.score == null ? null : Number(a.score),
			passed: a.passed,
			integrityScore: a.integrityScore,
			flagCount: a.flagCount,
			cameraMonitored: a.cameraMonitored,
			invalidated: a.invalidated,
			escalated: a.escalated,
		}));
	}

	/** Full integrity report for one attempt: flag timeline + proctoring shots. */
	async getAttemptReport(user: AuthenticatedUser, attemptId: string) {
		const attempt = await this.loadManagedAttempt(user, attemptId);
		const [logs, learner] = await Promise.all([
			this.prisma.assessmentAntiCheatLog.findMany({
				where: { attemptId },
				orderBy: { occurredAt: "asc" },
			}),
			attempt.userId
				? this.prisma.user.findUnique({
						where: { id: attempt.userId },
						select: { name: true, email: true },
					})
				: Promise.resolve(null),
		]);
		const events = await Promise.all(
			logs.map(async (l) => ({
				id: l.id,
				eventType: l.eventType,
				severity: l.severity,
				occurredAt: l.occurredAt,
				metadata: l.metadataJson,
				// Signing is best-effort — a missing/broken screenshot key must never
				// 500 the whole report (that left the admin modal spinning forever).
				screenshotUrl: l.screenshotKey
					? await this.storage
							.getSignedDownloadUrl(l.screenshotKey)
							.catch((e) => {
								this.logger.warn(
									`Could not sign proctoring screenshot ${l.screenshotKey}: ${(e as Error).message}`,
								);
								return null;
							})
					: null,
			})),
		);
		return {
			id: attempt.id,
			attemptNumber: attempt.attemptNumber,
			userName: learner?.name ?? null,
			userEmail: learner?.email ?? null,
			submittedAt: attempt.submittedAt,
			score: attempt.score == null ? null : Number(attempt.score),
			passed: attempt.passed,
			autoSubmitted: attempt.autoSubmitted,
			integrityScore: attempt.integrityScore,
			flagCount: attempt.flagCount,
			cameraMonitored: attempt.cameraMonitored,
			ipAddress: attempt.ipAddress,
			userAgent: attempt.userAgent,
			invalidated: attempt.invalidated,
			invalidatedReason: attempt.invalidatedReason,
			escalated: attempt.escalated,
			escalatedReason: attempt.escalatedReason,
			events,
		};
	}

	async invalidateAttempt(
		user: AuthenticatedUser,
		attemptId: string,
		reason?: string,
	) {
		const attempt = await this.loadManagedAttempt(user, attemptId);
		await this.prisma.assessmentAttempt.update({
			where: { id: attemptId },
			data: {
				invalidated: true,
				invalidatedBy: user.id,
				invalidatedReason: reason ?? null,
			},
		});
		// §8.6: Assessment invalidated → learner (in-app + email).
		if (attempt.userId) {
			const learner = await this.prisma.user.findUnique({
				where: { id: attempt.userId },
				select: { email: true },
			});
			if (learner) {
				await this.notifications.notify(attempt.userId, {
					type: "assessment_invalidated",
					dataJson: { reason: reason ?? null },
					inApp: true,
					email: {
						to: learner.email,
						subject: "An assessment attempt was invalidated",
						html: await renderNotificationEmail({
							preview: "An assessment attempt was invalidated",
							heading: "An attempt was invalidated",
							paragraphs: [
								`An integrity review invalidated one of your assessment attempts${reason ? ` (${reason})` : ""}.`,
								"You may need to retake it — check your course for the details.",
							],
							cta: "View my learning",
							ctaUrl: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/learn/mine`,
						}),
					},
				});
			}
		}
		return { invalidated: true };
	}

	async acceptAttempt(user: AuthenticatedUser, attemptId: string) {
		await this.loadManagedAttempt(user, attemptId);
		await this.prisma.assessmentAttempt.update({
			where: { id: attemptId },
			data: {
				invalidated: false,
				invalidatedBy: null,
				invalidatedReason: null,
				escalated: false,
			},
		});
		return { accepted: true };
	}

	async escalateAttempt(
		user: AuthenticatedUser,
		attemptId: string,
		reason?: string,
	) {
		await this.loadManagedAttempt(user, attemptId);
		await this.prisma.assessmentAttempt.update({
			where: { id: attemptId },
			data: {
				escalated: true,
				escalatedAt: new Date(),
				escalatedReason: reason ?? null,
			},
		});
		return { escalated: true };
	}

	/** Admin-only: every flagged/escalated/invalidated attempt across the platform. */
	async listAllIntegrityReports(user: AuthenticatedUser) {
		if (user.role !== "admin") {
			throw new ForbiddenException("Admin only");
		}
		const attempts = await this.prisma.assessmentAttempt.findMany({
			where: {
				submittedAt: { not: null },
				OR: [
					{ escalated: true },
					{ invalidated: true },
					{ integrityScore: { lt: 100 } },
					// An unmonitored attempt scores a clean 100 — without this it is
					// invisible to the one queue meant to surface problems (§4.6.2).
					{ cameraMonitored: false },
				],
			},
			include: {
				user: { select: { name: true, email: true } },
				assessment: { select: { id: true, title: true, scope: true } },
			},
			orderBy: [
				{ escalated: "desc" },
				{ integrityScore: "asc" },
				{ submittedAt: "desc" },
			],
			take: 200,
		});
		return attempts.map((a) => ({
			id: a.id,
			assessmentId: a.assessment?.id ?? null,
			assessmentTitle: a.assessment?.title ?? null,
			scope: a.assessment?.scope ?? null,
			userName: a.user?.name ?? null,
			userEmail: a.user?.email ?? null,
			submittedAt: a.submittedAt,
			score: a.score == null ? null : Number(a.score),
			passed: a.passed,
			integrityScore: a.integrityScore,
			flagCount: a.flagCount,
			cameraMonitored: a.cameraMonitored,
			invalidated: a.invalidated,
			escalated: a.escalated,
		}));
	}
}
