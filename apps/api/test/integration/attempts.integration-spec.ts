import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { AttemptsService } from "../../src/modules/assessments/attempts.service";
import { CompletionService } from "../../src/modules/completion/completion.service";
import type { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { LearningEvents } from "../../src/shared/events/learning-events";
import { getTestPrisma } from "./support/db";
import {
	createAssessment,
	createAssessmentAttempt,
	createLesson,
	createModule,
	createQuestion,
	createUser,
} from "./support/factories";
import { FakeAiAdapter } from "./support/fakes/fake-ai.adapter";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

function asAuthenticatedUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "learner" };
}

describe("AttemptsService (integration)", () => {
	const prisma = getTestPrisma();
	const events = new EventEmitter2();
	// A real CompletionService — the finals gate (§4.3) is part of what these
	// specs are checking, so stubbing it would hide the thing under test.
	const service = new AttemptsService(
		prisma,
		new FakeStorageAdapter(),
		new FakeAiAdapter(),
		events,
		new CompletionService(prisma, new FakeStorageAdapter(), events),
		// Integrity flags notify the creator + admins (§8.6) — a side effect here.
		{ notify: async () => {} } as unknown as NotificationsService,
	);

	let learnerId: string;
	let emitted: { event: string; payload: unknown }[] = [];

	events.onAny((event, payload) => {
		emitted.push({ event: String(event), payload });
	});

	beforeEach(async () => {
		emitted = [];
		learnerId = (await createUser(prisma, { role: "learner" })).id;
	});

	describe("getInfo", () => {
		it("is not eligible to start an assessment with no questions", async () => {
			const assessment = await createAssessment(prisma);
			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				assessment.id,
			);
			expect(info.canStart).toBe(false);
			expect(info.reason).toBe("no_questions");
		});
	});

	// ── A final only opens once the course work is done (§4.3) ──────────────
	describe("finals prerequisite gate", () => {
		/** A course with one module + one video lesson, and a course final. */
		async function courseWithFinal(slug: string) {
			const course = await prisma.course.create({
				data: { title: "C", slug, createdBy: learnerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
				minVideoWatchPct: 90,
			});
			const final = await createAssessment(prisma, {
				scope: "course_final",
				courseId: course.id,
			});
			await createQuestion(prisma, final.id);
			return { course, mod, lesson, final };
		}

		const watched = (lessonId: string, pct: number) =>
			prisma.lessonCompletion.create({
				data: { userId: learnerId, lessonId, videoWatchedPct: pct },
			});

		it("locks the final while lessons are unfinished", async () => {
			const { final } = await courseWithFinal("gate-locked");

			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				final.id,
			);
			expect(info.canStart).toBe(false);
			expect(info.reason).toBe("prerequisites");
			expect(info.prerequisitesMet).toBe(false);
		});

		it("refuses to start a locked final, not just hide it", async () => {
			const { final } = await courseWithFinal("gate-locked-start");

			// The UI locks the row, but the route stays reachable — the server is
			// what actually stops a direct navigation.
			await expect(
				service.startOrResume(
					asAuthenticatedUser(learnerId),
					final.id,
					undefined,
					undefined,
				),
			).rejects.toThrow(ConflictException);
			expect(
				await prisma.assessmentAttempt.count({
					where: { assessmentId: final.id },
				}),
			).toBe(0);
		});

		it("unlocks the final once every lesson is done", async () => {
			const { lesson, final } = await courseWithFinal("gate-unlocked");
			await watched(lesson.id, 95); // ≥ minVideoWatchPct

			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				final.id,
			);
			expect(info.prerequisitesMet).toBe(true);
			expect(info.canStart).toBe(true);
		});

		it("keeps the final locked while a module quiz is unpassed", async () => {
			const { mod, lesson, final } = await courseWithFinal("gate-module-quiz");
			await watched(lesson.id, 95);
			// A module quiz with questions the learner hasn't passed.
			const moduleQuiz = await createAssessment(prisma, {
				scope: "module",
				moduleId: mod.id,
			});
			await createQuestion(prisma, moduleQuiz.id);

			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				final.id,
			);
			expect(info.canStart).toBe(false);
			expect(info.reason).toBe("prerequisites");
		});

		it("never gates a formative quiz on the course's progress", async () => {
			const { lesson } = await courseWithFinal("gate-formative");
			const quiz = await createAssessment(prisma, {
				scope: "lesson_post",
				lessonId: lesson.id,
			});
			await createQuestion(prisma, quiz.id);

			// Nothing done yet — a lesson quiz must still be takeable.
			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				quiz.id,
			);
			expect(info.canStart).toBe(true);
			expect(info.prerequisitesMet).toBe(true);
		});
	});

	// ── Retry policy is for finals only (§4.4.1) ────────────────────────────
	describe("retry policy scope", () => {
		/** A used-up allowance: 1 retake allowed (2 tries), both failed. */
		async function exhaust(assessment: { id: string }) {
			await createQuestion(prisma, assessment.id);
			for (const n of [1, 2]) {
				const attempt = await createAssessmentAttempt(prisma, {
					assessmentId: assessment.id,
					userId: learnerId,
					passed: false,
					attemptNumber: n,
				});
				await prisma.assessmentAttempt.update({
					where: { id: attempt.id },
					data: { submittedAt: new Date() },
				});
			}
		}

		it("enforces the policy on a course final", async () => {
			const assessment = await createAssessment(prisma, {
				scope: "course_final",
			});
			await prisma.assessment.update({
				where: { id: assessment.id },
				data: { maxRetakes: 1, retakeCooldownHours: 24 },
			});
			await exhaust(assessment);

			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				assessment.id,
			);
			expect(info.hasRetryPolicy).toBe(true);
			expect(info.canStart).toBe(false);
			expect(info.reason).toBe("no_retakes_left");
			expect(info.retakesRemaining).toBe(0);
		});

		it("ignores the policy on a module quiz — practice stays unlimited", async () => {
			const assessment = await createAssessment(prisma, { scope: "module" });
			// Stale values on the row must not gate a formative quiz.
			await prisma.assessment.update({
				where: { id: assessment.id },
				data: { maxRetakes: 1, retakeCooldownHours: 24, retakeLockoutDays: 7 },
			});
			await exhaust(assessment);

			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				assessment.id,
			);
			expect(info.hasRetryPolicy).toBe(false);
			expect(info.canStart).toBe(true);
			expect(info.reason).toBeUndefined();
			expect(info.retakesRemaining).toBeNull();
			// The effective policy is reported as none, not the stale row values.
			expect(info.maxRetakes).toBeNull();
			expect(info.retakeCooldownHours).toBeNull();
			expect(info.retakeLockoutDays).toBeNull();
		});

		it("ignores the policy on a lesson quiz too", async () => {
			const assessment = await createAssessment(prisma, {
				scope: "lesson_post",
			});
			await prisma.assessment.update({
				where: { id: assessment.id },
				data: { maxRetakes: 0 },
			});
			await exhaust(assessment);

			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				assessment.id,
			);
			expect(info.canStart).toBe(true);
		});

		it("still blocks a passed formative quiz from being retaken", async () => {
			const assessment = await createAssessment(prisma, { scope: "module" });
			await createQuestion(prisma, assessment.id);
			const attempt = await createAssessmentAttempt(prisma, {
				assessmentId: assessment.id,
				userId: learnerId,
				passed: true,
			});
			await prisma.assessmentAttempt.update({
				where: { id: attempt.id },
				data: { submittedAt: new Date() },
			});

			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				assessment.id,
			);
			expect(info.canStart).toBe(false);
			expect(info.reason).toBe("already_passed");
		});
	});

	describe("startOrResume", () => {
		it("starts a new attempt at attemptNumber 1", async () => {
			const assessment = await createAssessment(prisma);
			await createQuestion(prisma, assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			expect(state.attemptNumber).toBe(1);
			expect(state.status).toBe("in_progress");
		});

		it("resumes the existing in-progress attempt instead of creating a new one", async () => {
			const assessment = await createAssessment(prisma);
			await createQuestion(prisma, assessment.id);
			const first = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			const second = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			expect(second.attemptId).toBe(first.attemptId);
			const count = await prisma.assessmentAttempt.count({
				where: { assessmentId: assessment.id, userId: learnerId },
			});
			expect(count).toBe(1);
		});

		it("rejects starting again once the learner has already passed", async () => {
			const assessment = await createAssessment(prisma);
			await createQuestion(prisma, assessment.id);
			await prisma.assessmentAttempt.create({
				data: {
					assessmentId: assessment.id,
					userId: learnerId,
					attemptNumber: 1,
					submittedAt: new Date(),
					passed: true,
				},
			});
			await expect(
				service.startOrResume(
					asAuthenticatedUser(learnerId),
					assessment.id,
					undefined,
					undefined,
				),
			).rejects.toThrow(ConflictException);
		});

		it("rejects starting once retakes are exhausted", async () => {
			const assessment = await createAssessment(prisma, { passMark: 70 });
			await prisma.assessment.update({
				where: { id: assessment.id },
				data: { maxRetakes: 0 },
			});
			await createQuestion(prisma, assessment.id);
			await prisma.assessmentAttempt.create({
				data: {
					assessmentId: assessment.id,
					userId: learnerId,
					attemptNumber: 1,
					submittedAt: new Date(),
					passed: false,
				},
			});
			await expect(
				service.startOrResume(
					asAuthenticatedUser(learnerId),
					assessment.id,
					undefined,
					undefined,
				),
			).rejects.toThrow(ConflictException);
		});

		it("auto-submits an expired in-progress attempt, then starts a fresh one", async () => {
			const assessment = await createAssessment(prisma);
			await prisma.assessment.update({
				where: { id: assessment.id },
				data: { timeLimitMinutes: 1 },
			});
			await createQuestion(prisma, assessment.id);
			const first = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			await prisma.assessmentAttempt.update({
				where: { id: first.attemptId },
				data: { startedAt: new Date(Date.now() - 5 * 60_000) },
			});
			const second = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			expect(second.attemptId).not.toBe(first.attemptId);
			expect(second.attemptNumber).toBe(2);
			const expired = await prisma.assessmentAttempt.findUnique({
				where: { id: first.attemptId },
			});
			expect(expired?.submittedAt).not.toBeNull();
			expect(expired?.autoSubmitted).toBe(true);
		});
	});

	describe("saveAnswer", () => {
		it("rejects a question that isn't part of the attempt's snapshot", async () => {
			const assessment = await createAssessment(prisma);
			await createQuestion(prisma, assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			await expect(
				service.saveAnswer(asAuthenticatedUser(learnerId), state.attemptId, {
					questionId: "00000000-0000-0000-0000-000000000000",
					answer: "A",
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("saves a valid answer", async () => {
			const assessment = await createAssessment(prisma);
			const question = await createQuestion(prisma, assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			const result = await service.saveAnswer(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{ questionId: question.id, answer: "A" },
			);
			expect(result.saved).toBe(true);
		});
	});

	describe("ownership", () => {
		it("forbids accessing another learner's attempt", async () => {
			const assessment = await createAssessment(prisma);
			await createQuestion(prisma, assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			const other = await createUser(prisma, { role: "learner" });
			await expect(
				service.getAttempt(asAuthenticatedUser(other.id), state.attemptId),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("submit + grading", () => {
		it("grades correctly against the real question set and persists the result", async () => {
			const assessment = await createAssessment(prisma, { passMark: 50 });
			const q1 = await createQuestion(prisma, assessment.id);
			await prisma.question.update({
				where: { id: q1.id },
				data: { correctAnswer: "A" },
			});
			const q2 = await createQuestion(prisma, assessment.id);
			await prisma.question.update({
				where: { id: q2.id },
				data: { correctAnswer: "B" },
			});
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			await service.saveAnswer(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{
					questionId: q1.id,
					answer: "A",
				},
			);
			await service.saveAnswer(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{
					questionId: q2.id,
					answer: "WRONG",
				},
			);
			const result = await service.submit(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{},
			);
			expect(result.score).toBe(50);
			expect(result.passed).toBe(true); // 50 >= passMark 50

			await expect(
				service.getResult(asAuthenticatedUser(learnerId), state.attemptId),
			).resolves.toBeTruthy();
		});

		// Stream B — a code question grades through the same server-side AI path as
		// short_answer (§9). The learner's editor carries {language, starterCode};
		// the reference solution stays server-side in correctAnswer.
		it("grades a code question via AI and exposes its config without the solution", async () => {
			const assessment = await createAssessment(prisma, { passMark: 50 });
			const code = await prisma.question.create({
				data: {
					assessmentId: assessment.id,
					type: "code",
					body: "Write add(a, b).",
					optionsJson: {
						language: "javascript",
						starterCode: "function add(a, b) {}",
					},
					correctAnswer: "return a + b",
					points: 1,
				},
			});
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			// The learner receives the language + starter, never the reference.
			const shown = state.questions.find((q) => q.id === code.id);
			expect(shown?.codeConfig).toEqual({
				language: "javascript",
				starterCode: "function add(a, b) {}",
			});
			expect(JSON.stringify(state)).not.toContain("return a + b");

			// A different-cased-but-equivalent answer misses the exact match and is
			// upheld by the (fake) AI grader — proving code takes the AI path.
			await service.saveAnswer(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{
					questionId: code.id,
					answer: "RETURN A + B",
				},
			);
			const result = await service.submit(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{},
			);
			expect(result.score).toBe(100);
			expect(result.passed).toBe(true);
		});

		it("getResult rejects an attempt that hasn't been submitted yet", async () => {
			const assessment = await createAssessment(prisma);
			await createQuestion(prisma, assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			await expect(
				service.getResult(asAuthenticatedUser(learnerId), state.attemptId),
			).rejects.toThrow(BadRequestException);
		});

		it("carries previousBest + delta across attempts for growth framing (Phase 4, §3.1)", async () => {
			const assessment = await createAssessment(prisma, { passMark: 70 });
			const q1 = await createQuestion(prisma, assessment.id);
			await prisma.question.update({
				where: { id: q1.id },
				data: { correctAnswer: "A" },
			});
			const q2 = await createQuestion(prisma, assessment.id);
			await prisma.question.update({
				where: { id: q2.id },
				data: { correctAnswer: "B" },
			});

			// Attempt 1: 50% — below the pass mark, so a retake is allowed.
			const first = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			await service.saveAnswer(
				asAuthenticatedUser(learnerId),
				first.attemptId,
				{
					questionId: q1.id,
					answer: "A",
				},
			);
			const r1 = await service.submit(
				asAuthenticatedUser(learnerId),
				first.attemptId,
				{},
			);
			expect(r1.score).toBe(50);
			expect(r1.previousBest).toBeNull();
			expect(r1.delta).toBeNull();

			// Attempt 2: 100% — growth of +50 over the previous best.
			const second = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			for (const [qid, answer] of [
				[q1.id, "A"],
				[q2.id, "B"],
			] as const) {
				await service.saveAnswer(
					asAuthenticatedUser(learnerId),
					second.attemptId,
					{ questionId: qid, answer },
				);
			}
			const r2 = await service.submit(
				asAuthenticatedUser(learnerId),
				second.attemptId,
				{},
			);
			expect(r2.score).toBe(100);
			expect(r2.previousBest).toBe(50);
			expect(r2.delta).toBe(50);
		});

		it("emits AttemptSubmitted with the graded snapshot on finalize (Phase 4, §6.4)", async () => {
			const assessment = await createAssessment(prisma, { passMark: 50 });
			const q1 = await createQuestion(prisma, assessment.id);
			await prisma.question.update({
				where: { id: q1.id },
				data: { correctAnswer: "A" },
			});
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			await service.saveAnswer(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{
					questionId: q1.id,
					answer: "A",
				},
			);
			await service.submit(asAuthenticatedUser(learnerId), state.attemptId, {});

			const submissions = emitted.filter(
				(e) => e.event === LearningEvents.AttemptSubmitted,
			);
			expect(submissions).toHaveLength(1);
			expect(submissions[0].payload).toMatchObject({
				userId: learnerId,
				assessmentId: assessment.id,
				scope: assessment.scope,
				score: 100,
				passed: true,
				attemptNumber: 1,
			});
		});
	});

	// §9 — a code question set to `grading: "manual"` holds the attempt: submitted
	// but ungraded until an instructor grades it, at which point the score/pass are
	// recomputed and the learner's result is released.
	describe("manual grading", () => {
		async function ownedAssessment() {
			const owner = await createUser(prisma, { role: "instructor" });
			const assessment = await createAssessment(prisma, { passMark: 50 });
			await prisma.assessment.update({
				where: { id: assessment.id },
				data: { createdBy: owner.id },
			});
			const ownerUser: AuthenticatedUser = {
				id: owner.id,
				email: `${owner.id}@example.com`,
				role: "instructor",
			};
			return { assessment, ownerUser };
		}
		const manualCode = (assessmentId: string) =>
			prisma.question.create({
				data: {
					assessmentId,
					type: "code",
					body: "Write a function.",
					optionsJson: { language: "javascript", grading: "manual" },
					points: 1,
				},
			});

		it("holds the attempt pending and blocks a retake until it's graded", async () => {
			const { assessment, ownerUser } = await ownedAssessment();
			const code = await manualCode(assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			await service.saveAnswer(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{
					questionId: code.id,
					answer: "function add(a, b) { return a + b; }",
				},
			);
			const result = await service.submit(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{},
			);
			expect(result.pendingGrading).toBe(true);
			expect(result.passed).toBeNull();
			// It's submitted but ungraded on the record.
			const row = await prisma.assessmentAttempt.findUnique({
				where: { id: state.attemptId },
			});
			expect(row?.submittedAt).not.toBeNull();
			expect(row?.gradedAt).toBeNull();

			// No retake while held.
			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				assessment.id,
			);
			expect(info.canStart).toBe(false);
			expect(info.reason).toBe("awaiting_grading");
			expect(info.pendingGradingAttemptId).toBe(state.attemptId);

			// The queue surfaces the held code answer to its owner.
			const queue = await service.listPendingManual(ownerUser, assessment.id);
			expect(queue.attempts).toHaveLength(1);
			expect(queue.attempts[0].answers.map((a) => a.questionId)).toEqual([
				code.id,
			]);
		});

		it("recomputes the score and releases the result once graded", async () => {
			const { assessment, ownerUser } = await ownedAssessment();
			const code = await manualCode(assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			await service.saveAnswer(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{
					questionId: code.id,
					answer: "solved",
				},
			);
			await service.submit(asAuthenticatedUser(learnerId), state.attemptId, {});

			const graded = await service.gradeManual(ownerUser, state.attemptId, {
				verdicts: [{ questionId: code.id, correct: true }],
				feedback: "Clean solution.",
			});
			expect(graded.pendingGrading).toBe(false);
			expect(graded.score).toBe(100);
			expect(graded.passed).toBe(true);
			// The held reason is gone (the learner passed, so a retake isn't offered).
			const info = await service.getInfo(
				asAuthenticatedUser(learnerId),
				assessment.id,
			);
			expect(info.reason).not.toBe("awaiting_grading");
		});

		it("refuses grading by anyone but the assessment's owner", async () => {
			const { assessment } = await ownedAssessment();
			const code = await manualCode(assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			await service.saveAnswer(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{
					questionId: code.id,
					answer: "x",
				},
			);
			await service.submit(asAuthenticatedUser(learnerId), state.attemptId, {});
			const stranger = await createUser(prisma, { role: "instructor" });
			await expect(
				service.gradeManual(
					{
						id: stranger.id,
						email: `${stranger.id}@example.com`,
						role: "instructor",
					},
					state.attemptId,
					{ verdicts: [{ questionId: code.id, correct: true }] },
				),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("anti-cheat ingestion", () => {
		it("recomputes integrity and signals auto-submit once the tab-switch limit is hit", async () => {
			const assessment = await createAssessment(prisma);
			await prisma.assessment.update({
				where: { id: assessment.id },
				data: { anticheatTabSwitchLimit: 2 },
			});
			await createQuestion(prisma, assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			const result = await service.ingestAntiCheat(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{
					events: [{ eventType: "tab_switch" }, { eventType: "tab_switch" }],
				},
			);
			expect(result.tabSwitches).toBe(2);
			expect(result.autoSubmit).toBe(true);
			expect(result.integrityScore).toBeLessThan(100);
		});

		/**
		 * §4.6.2 — the camera monitor failing is a fact about our software, not the
		 * learner's conduct. It must cost them nothing, and must still make the
		 * attempt distinguishable from one that was actually watched and clean.
		 */
		describe("camera monitor unavailable", () => {
			async function startAttempt() {
				const assessment = await createAssessment(prisma);
				await createQuestion(prisma, assessment.id);
				const state = await service.startOrResume(
					asAuthenticatedUser(learnerId),
					assessment.id,
					undefined,
					undefined,
				);
				return state.attemptId;
			}

			it("records it without penalty, and never as a flag", async () => {
				const attemptId = await startAttempt();

				const result = await service.ingestAntiCheat(
					asAuthenticatedUser(learnerId),
					attemptId,
					{ events: [{ eventType: "camera_monitor_unavailable" }] },
				);

				expect(result.integrityScore).toBe(100); // not their fault
				expect(result.flagCount).toBe(0); // not an accusation

				const attempt = await prisma.assessmentAttempt.findUnique({
					where: { id: attemptId },
				});
				// The fact itself is on the record — this is what stops a clean 100
				// being mistaken for a monitored, clean attempt.
				expect(attempt?.cameraMonitored).toBe(false);
			});

			it("stores it as info severity even if the client claims otherwise", async () => {
				const attemptId = await startAttempt();
				await service.ingestAntiCheat(
					asAuthenticatedUser(learnerId),
					attemptId,
					{
						events: [
							{ eventType: "camera_monitor_unavailable", severity: "high" },
						],
					},
				);

				const log = await prisma.assessmentAntiCheatLog.findFirst({
					where: { attemptId, eventType: "camera_monitor_unavailable" },
				});
				expect(log?.severity).toBe("info");
			});

			/** The exploit `info` would otherwise open: a weightless real flag. */
			it("refuses a client-claimed info severity on a real flag", async () => {
				const attemptId = await startAttempt();
				await service.ingestAntiCheat(
					asAuthenticatedUser(learnerId),
					attemptId,
					{
						events: [{ eventType: "tab_switch", severity: "info" as "low" }],
					},
				);

				const log = await prisma.assessmentAntiCheatLog.findFirst({
					where: { attemptId, eventType: "tab_switch" },
				});
				expect(log?.severity).toBe("medium"); // the event's real default
				const attempt = await prisma.assessmentAttempt.findUnique({
					where: { id: attemptId },
				});
				expect(attempt?.integrityScore).toBe(95); // penalty still applied
			});

			it("keeps the unmonitored fact through submission", async () => {
				const attemptId = await startAttempt();
				await service.ingestAntiCheat(
					asAuthenticatedUser(learnerId),
					attemptId,
					{
						events: [{ eventType: "camera_monitor_unavailable" }],
					},
				);

				await service.submit(asAuthenticatedUser(learnerId), attemptId, {});

				const attempt = await prisma.assessmentAttempt.findUnique({
					where: { id: attemptId },
				});
				// Submit recomputes from the logs — the fact must survive it.
				expect(attempt?.cameraMonitored).toBe(false);
				expect(attempt?.integrityScore).toBe(100);
				expect(attempt?.flagCount).toBe(0);
			});
		});
	});

	describe("proctoring snapshot", () => {
		it("rejects an invalid proctoring event type", async () => {
			const assessment = await createAssessment(prisma);
			await createQuestion(prisma, assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			await expect(
				service.ingestProctoringSnapshot(
					asAuthenticatedUser(learnerId),
					state.attemptId,
					{
						buffer: Buffer.from("img"),
						mimetype: "image/jpeg",
						size: 100,
						originalname: "shot.jpg",
					},
					"tab_switch",
				),
			).rejects.toThrow(BadRequestException);
		});

		it("stores a valid camera snapshot and recomputes integrity", async () => {
			const assessment = await createAssessment(prisma);
			await createQuestion(prisma, assessment.id);
			const state = await service.startOrResume(
				asAuthenticatedUser(learnerId),
				assessment.id,
				undefined,
				undefined,
			);
			const result = await service.ingestProctoringSnapshot(
				asAuthenticatedUser(learnerId),
				state.attemptId,
				{
					buffer: Buffer.from("img"),
					mimetype: "image/jpeg",
					size: 100,
					originalname: "shot.jpg",
				},
				"camera_face_missing",
			);
			expect(result.stored).toBe(true);
			expect(result.integrityScore).toBeLessThan(100);
		});
	});
});
