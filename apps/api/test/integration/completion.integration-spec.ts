import { EventEmitter2 } from "@nestjs/event-emitter";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { CompletionService } from "../../src/modules/completion/completion.service";
import { LearningEvents } from "../../src/shared/events/learning-events";
import { getTestPrisma } from "./support/db";
import {
	createAssessment,
	createAssessmentAttempt,
	createCohort,
	createCohortCourse,
	createCourse,
	createLesson,
	createModule,
	createPath,
	createPathCourse,
	createProject,
	createProjectSubmission,
	createQuestion,
	createUser,
} from "./support/factories";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

function asAuthenticatedUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "learner" };
}

describe("CompletionService (integration)", () => {
	const prisma = getTestPrisma();
	const events = new EventEmitter2();
	const service = new CompletionService(
		prisma,
		new FakeStorageAdapter(),
		events,
	);

	let learnerId: string;
	let emitted: { event: string; payload: unknown }[] = [];

	events.onAny((event, payload) => {
		emitted.push({ event: String(event), payload });
	});

	beforeEach(async () => {
		emitted = [];
		const learner = await createUser(prisma, { role: "learner" });
		learnerId = learner.id;
	});

	describe("recordLessonProgress — video lessons", () => {
		it("is not done below the (default 80%) watch threshold", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			const result = await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 50 },
			);
			expect(result.done).toBe(false);
			expect(result.course.summary.isComplete).toBe(false);
		});

		it("is done once the watch threshold is reached, completing a single-lesson course", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			const result = await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 85 },
			);
			expect(result.done).toBe(true);
			expect(result.course.summary.isComplete).toBe(true);
			expect(result.course.summary.percent).toBe(100);
		});

		it("is monotonic — watching back to a lower % never un-completes the lesson", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{
					videoWatchedPct: 90,
				},
			);
			const result = await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 10 },
			);
			expect(result.watchedPct).toBe(90);
			expect(result.done).toBe(true);
		});
	});

	describe("recordLessonProgress — readable (text/pdf) lessons", () => {
		it("requires scrolling to the end, not a video watch %, to complete", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "text",
			});
			const partial = await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 90 }, // irrelevant for readable content
			);
			expect(partial.done).toBe(false);
			const finished = await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ scrolledToEnd: true },
			);
			expect(finished.done).toBe(true);
		});
	});

	describe("recordLessonProgress — post-lesson quiz gate", () => {
		it("blocks completion until a real (has-questions) post-quiz is passed", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
				hasPostQuiz: true,
			});
			const quiz = await createAssessment(prisma, {
				scope: "lesson_post",
				lessonId: lesson.id,
			});
			await createQuestion(prisma, quiz.id);

			const watchedOnly = await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 100 },
			);
			expect(watchedOnly.done).toBe(false);

			await createAssessmentAttempt(prisma, {
				assessmentId: quiz.id,
				userId: learnerId,
				passed: true,
			});
			const afterPass = await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 100 },
			);
			expect(afterPass.done).toBe(true);
		});

		it("getLessonContext exposes each quiz's bestScore for growth framing (Phase 4, §3.1)", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
				hasPreQuiz: true,
				hasPostQuiz: true,
			});
			const pre = await createAssessment(prisma, {
				scope: "lesson_pre",
				lessonId: lesson.id,
			});
			await createQuestion(prisma, pre.id);
			const post = await createAssessment(prisma, {
				scope: "lesson_post",
				lessonId: lesson.id,
			});
			await createQuestion(prisma, post.id);

			await createAssessmentAttempt(prisma, {
				assessmentId: pre.id,
				userId: learnerId,
				passed: false,
				score: 40,
			});
			await createAssessmentAttempt(prisma, {
				assessmentId: post.id,
				userId: learnerId,
				passed: false,
				score: 30,
				attemptNumber: 1,
			});
			await createAssessmentAttempt(prisma, {
				assessmentId: post.id,
				userId: learnerId,
				passed: true,
				score: 80,
				attemptNumber: 2,
			});
			// Invalidated attempts never count towards the best score.
			await createAssessmentAttempt(prisma, {
				assessmentId: post.id,
				userId: learnerId,
				passed: true,
				score: 100,
				invalidated: true,
				attemptNumber: 3,
			});

			const context = await service.getLessonContext(
				asAuthenticatedUser(learnerId),
				lesson.id,
			);
			expect(context.preQuiz).toEqual({
				id: pre.id,
				passed: false,
				bestScore: 40,
			});
			expect(context.postQuiz).toEqual({
				id: post.id,
				passed: true,
				bestScore: 80,
			});
		});

		it("getLessonContext reports bestScore null when a quiz is unattempted", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
				hasPostQuiz: true,
			});
			const post = await createAssessment(prisma, {
				scope: "lesson_post",
				lessonId: lesson.id,
			});
			await createQuestion(prisma, post.id);

			const context = await service.getLessonContext(
				asAuthenticatedUser(learnerId),
				lesson.id,
			);
			expect(context.preQuiz).toBeNull();
			expect(context.postQuiz).toEqual({
				id: post.id,
				passed: false,
				bestScore: null,
			});
		});

		it("does not gate on a flagged post-quiz that has no real questions", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
				hasPostQuiz: true,
			});
			await createAssessment(prisma, {
				scope: "lesson_post",
				lessonId: lesson.id,
			}); // no questions
			const result = await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 100 },
			);
			expect(result.done).toBe(true);
		});
	});

	describe("getCourseProgress", () => {
		it("is 0% and incomplete before any lesson progress", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			await createLesson(prisma, mod.id);
			const progress = await service.getCourseProgress(
				asAuthenticatedUser(learnerId),
				course.id,
			);
			expect(progress.summary.percent).toBe(0);
			expect(progress.summary.isComplete).toBe(false);
		});

		it("gates completion on a real module assessment until it's passed", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			const quiz = await createAssessment(prisma, {
				scope: "module",
				moduleId: mod.id,
			});
			await createQuestion(prisma, quiz.id);
			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{
					videoWatchedPct: 100,
				},
			);

			const stillPending = await service.getCourseProgress(
				asAuthenticatedUser(learnerId),
				course.id,
			);
			expect(stillPending.summary.isComplete).toBe(false);

			await createAssessmentAttempt(prisma, {
				assessmentId: quiz.id,
				userId: learnerId,
				passed: true,
			});
			const afterPass = await service.getCourseProgress(
				asAuthenticatedUser(learnerId),
				course.id,
			);
			expect(afterPass.summary.isComplete).toBe(true);
		});

		it("does not gate on an assessment row that has zero real questions", async () => {
			const course = await createCourse(prisma, { status: "published" });
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			await createAssessment(prisma, { scope: "module", moduleId: mod.id }); // no questions
			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{
					videoWatchedPct: 100,
				},
			);
			const progress = await service.getCourseProgress(
				asAuthenticatedUser(learnerId),
				course.id,
			);
			expect(progress.summary.isComplete).toBe(true);
		});

		it("gates completion on an unpassed project, then completes once it's passed", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			const project = await createProject(prisma, {
				scope: "course",
				courseId: course.id,
			});
			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{
					videoWatchedPct: 100,
				},
			);

			const pending = await service.getCourseProgress(
				asAuthenticatedUser(learnerId),
				course.id,
			);
			expect(pending.summary.isComplete).toBe(false);

			await createProjectSubmission(prisma, {
				projectId: project.id,
				userId: learnerId,
				passed: true,
			});
			const done = await service.getCourseProgress(
				asAuthenticatedUser(learnerId),
				course.id,
			);
			expect(done.summary.isComplete).toBe(true);
		});

		it("persists completion and keeps completedAt stable across repeated calls", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{
					videoWatchedPct: 100,
				},
			);

			const first = await prisma.completionStatus.findUnique({
				where: {
					userId_entityType_entityId: {
						userId: learnerId,
						entityType: "course",
						entityId: course.id,
					},
				},
			});
			expect(first?.isComplete).toBe(true);
			expect(first?.completedAt).not.toBeNull();

			await service.getCourseProgress(
				asAuthenticatedUser(learnerId),
				course.id,
			);
			const second = await prisma.completionStatus.findUnique({
				where: {
					userId_entityType_entityId: {
						userId: learnerId,
						entityType: "course",
						entityId: course.id,
					},
				},
			});
			expect(second?.completedAt?.getTime()).toBe(
				first?.completedAt?.getTime(),
			);
		});
	});

	describe("getPathProgress", () => {
		it("is complete when the required course is done, even with an incomplete optional course", async () => {
			const path = await createPath(prisma);
			const requiredCourse = await createCourse(prisma);
			const requiredModule = await createModule(prisma, requiredCourse.id);
			const requiredLesson = await createLesson(prisma, requiredModule.id, {
				contentType: "video",
			});
			const optionalCourse = await createCourse(prisma);
			const optionalModule = await createModule(prisma, optionalCourse.id);
			// Left unwatched on purpose — the optional course must stay incomplete.
			await createLesson(prisma, optionalModule.id, { contentType: "video" });

			await createPathCourse(prisma, {
				pathId: path.id,
				courseId: requiredCourse.id,
				isRequired: true,
				orderIndex: 1,
			});
			await createPathCourse(prisma, {
				pathId: path.id,
				courseId: optionalCourse.id,
				isRequired: false,
				orderIndex: 2,
			});

			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				requiredLesson.id,
				{ videoWatchedPct: 100 },
			);

			const progress = await service.getPathProgress(
				asAuthenticatedUser(learnerId),
				path.id,
			);
			expect(progress.summary.isComplete).toBe(true);
			expect(progress.courses).toHaveLength(2);
		});
	});

	describe("getCohortProgress", () => {
		it("is complete when its course, assessment and project are all satisfied", async () => {
			const cohort = await createCohort(prisma);
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			await createCohortCourse(prisma, {
				cohortId: cohort.id,
				courseId: course.id,
			});

			const cohortAssessment = await createAssessment(prisma, {
				scope: "cohort",
				cohortId: cohort.id,
			});
			await createQuestion(prisma, cohortAssessment.id);
			const cohortProject = await createProject(prisma, {
				scope: "cohort",
				cohortId: cohort.id,
			});

			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{
					videoWatchedPct: 100,
				},
			);
			await createAssessmentAttempt(prisma, {
				assessmentId: cohortAssessment.id,
				userId: learnerId,
				passed: true,
			});
			await createProjectSubmission(prisma, {
				projectId: cohortProject.id,
				userId: learnerId,
				passed: true,
			});

			const progress = await service.getCohortProgress(
				asAuthenticatedUser(learnerId),
				cohort.id,
			);
			expect(progress.summary.isComplete).toBe(true);
			expect(progress.summary.percent).toBe(100);
		});
	});

	describe("learning events (Phase 4, §6.4)", () => {
		it("emits LessonCompleted exactly once on the completion flip", async () => {
			const course = await createCourse(prisma, { title: "Event Course" });
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
				title: "Event Lesson",
			});

			// Below threshold → no event.
			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 50 },
			);
			expect(
				emitted.filter((e) => e.event === LearningEvents.LessonCompleted),
			).toHaveLength(0);

			// Crossing the threshold flips completion → exactly one event, with
			// the snapshot payload consumers rely on (titles included).
			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 100 },
			);
			const completions = emitted.filter(
				(e) => e.event === LearningEvents.LessonCompleted,
			);
			expect(completions).toHaveLength(1);
			expect(completions[0].payload).toMatchObject({
				userId: learnerId,
				lessonId: lesson.id,
				courseId: course.id,
				lessonTitle: "Event Lesson",
				courseTitle: "Event Course",
			});

			// Re-reporting an already-complete lesson must NOT re-emit.
			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 100 },
			);
			expect(
				emitted.filter((e) => e.event === LearningEvents.LessonCompleted),
			).toHaveLength(1);
		});

		it("emits EntityCompleted once when the course completion flips (lazy recompute)", async () => {
			const course = await createCourse(prisma);
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});

			// Completing the single lesson recomputes the course → one flip.
			await service.recordLessonProgress(
				asAuthenticatedUser(learnerId),
				lesson.id,
				{ videoWatchedPct: 100 },
			);
			const flips = emitted.filter(
				(e) => e.event === LearningEvents.EntityCompleted,
			);
			expect(flips).toHaveLength(1);
			expect(flips[0].payload).toMatchObject({
				userId: learnerId,
				entityType: "course",
				entityId: course.id,
			});

			// Re-reading progress re-runs persistCompletion but must not re-emit.
			await service.getCourseProgress(
				asAuthenticatedUser(learnerId),
				course.id,
			);
			expect(
				emitted.filter((e) => e.event === LearningEvents.EntityCompleted),
			).toHaveLength(1);
		});
	});
});
