import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { AttemptsService } from "../../src/modules/assessments/attempts.service";
import { getTestPrisma } from "./support/db";
import {
	createAssessment,
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
	const service = new AttemptsService(
		prisma,
		new FakeStorageAdapter(),
		new FakeAiAdapter(),
	);

	let learnerId: string;

	beforeEach(async () => {
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
