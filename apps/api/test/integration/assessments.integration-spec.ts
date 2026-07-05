import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { AssessmentsService } from "../../src/modules/assessments/assessments.service";
import { getTestPrisma } from "./support/db";
import {
	createAssessmentAttempt,
	createCohort,
	createLesson,
	createModule,
	createUser,
} from "./support/factories";
import { FakeAiAdapter } from "./support/fakes/fake-ai.adapter";
import { FakeMediaEncoderAdapter } from "./support/fakes/fake-media-encoder.adapter";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

function asAuthenticatedUser(
	id: string,
	role: AuthenticatedUser["role"] = "instructor",
): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role };
}

describe("AssessmentsService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new AssessmentsService(
		prisma,
		new FakeAiAdapter(),
		new FakeStorageAdapter(),
		new FakeMediaEncoderAdapter(),
	);

	let ownerId: string;
	let otherId: string;
	let adminId: string;

	beforeEach(async () => {
		ownerId = (await createUser(prisma, { role: "instructor" })).id;
		otherId = (await createUser(prisma, { role: "instructor" })).id;
		adminId = (await createUser(prisma, { role: "admin" })).id;
	});

	describe("createAssessment + ownership", () => {
		it("requires the parent id matching the scope", async () => {
			await expect(
				service.createAssessment(asAuthenticatedUser(ownerId), {
					scope: "course_final",
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("forbids a non-owner instructor from creating a course-scoped assessment", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "assess-course", createdBy: ownerId },
			});
			await expect(
				service.createAssessment(asAuthenticatedUser(otherId), {
					scope: "course_final",
					courseId: course.id,
				}),
			).rejects.toThrow(ForbiddenException);
		});

		it("allows the course owner to create a course-scoped assessment", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "assess-course-2", createdBy: ownerId },
			});
			const assessment = await service.createAssessment(
				asAuthenticatedUser(ownerId),
				{ scope: "course_final", courseId: course.id },
			);
			expect(assessment.courseId).toBe(course.id);
			expect(assessment.createdBy).toBe(ownerId);
		});

		it("cohort-scoped assessments are admin-only, regardless of instructor ownership", async () => {
			const cohort = await createCohort(prisma);
			await expect(
				service.createAssessment(asAuthenticatedUser(ownerId), {
					scope: "cohort",
					cohortId: cohort.id,
				}),
			).rejects.toThrow(ForbiddenException);
			const assessment = await service.createAssessment(
				asAuthenticatedUser(adminId, "admin"),
				{ scope: "cohort", cohortId: cohort.id },
			);
			expect(assessment.cohortId).toBe(cohort.id);
		});
	});

	describe("listForParent", () => {
		it("requires at least one parent id", async () => {
			await expect(
				service.listForParent(asAuthenticatedUser(ownerId), {}),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("questions", () => {
		it("auto-increments question orderIndex and reorders them", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "questions-course", createdBy: ownerId },
			});
			const assessment = await service.createAssessment(
				asAuthenticatedUser(ownerId),
				{ scope: "course_final", courseId: course.id },
			);
			const q1 = await service.addQuestion(
				asAuthenticatedUser(ownerId),
				assessment.id,
				{ type: "true_false", body: "Q1", correctAnswer: "true" },
			);
			const q2 = await service.addQuestion(
				asAuthenticatedUser(ownerId),
				assessment.id,
				{ type: "true_false", body: "Q2", correctAnswer: "false" },
			);
			expect(q1.orderIndex).toBe(1);
			expect(q2.orderIndex).toBe(2);

			await service.reorderQuestions(
				asAuthenticatedUser(ownerId),
				assessment.id,
				[q2.id, q1.id],
			);
			const reordered = await prisma.question.findMany({
				where: { assessmentId: assessment.id },
				orderBy: { orderIndex: "asc" },
			});
			expect(reordered.map((q) => q.id)).toEqual([q2.id, q1.id]);
		});
	});

	describe("updateAssessment", () => {
		it("converts scheduledAt/dueAt date strings", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "update-course", createdBy: ownerId },
			});
			const assessment = await service.createAssessment(
				asAuthenticatedUser(ownerId),
				{ scope: "course_final", courseId: course.id },
			);
			const updated = await service.updateAssessment(
				asAuthenticatedUser(ownerId),
				assessment.id,
				{ dueAt: "2026-09-01T00:00:00.000Z" },
			);
			expect(updated.dueAt?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
		});
	});

	describe("generateQuestions", () => {
		it("rejects when the lesson has no transcript, text, or readable media", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "gen-course", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			const assessment = await service.createAssessment(
				asAuthenticatedUser(ownerId),
				{ scope: "lesson_post", lessonId: lesson.id },
			);
			await expect(
				service.generateQuestions(
					asAuthenticatedUser(ownerId),
					assessment.id,
					{},
				),
			).rejects.toThrow(BadRequestException);
		});

		it("generates and appends questions from a lesson transcript", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "gen-course-2", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			await prisma.lesson.update({
				where: { id: lesson.id },
				data: {
					transcriptText:
						"A long enough transcript to pass the forty-character minimum easily.",
				},
			});
			const assessment = await service.createAssessment(
				asAuthenticatedUser(ownerId),
				{ scope: "lesson_post", lessonId: lesson.id },
			);
			const questions = await service.generateQuestions(
				asAuthenticatedUser(ownerId),
				assessment.id,
				{ count: 3 },
			);
			expect(questions).toHaveLength(3);
		});
	});

	describe("anti-cheat reporting", () => {
		it("lists attempts most-suspicious (lowest integrity) first", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "report-course", createdBy: ownerId },
			});
			const assessment = await service.createAssessment(
				asAuthenticatedUser(ownerId),
				{ scope: "course_final", courseId: course.id },
			);
			const learnerA = await createUser(prisma, { role: "learner" });
			const learnerB = await createUser(prisma, { role: "learner" });
			const attemptA = await createAssessmentAttempt(prisma, {
				assessmentId: assessment.id,
				userId: learnerA.id,
				passed: true,
			});
			await prisma.assessmentAttempt.update({
				where: { id: attemptA.id },
				data: { submittedAt: new Date(), integrityScore: 90 },
			});
			const attemptB = await createAssessmentAttempt(prisma, {
				assessmentId: assessment.id,
				userId: learnerB.id,
				passed: false,
			});
			await prisma.assessmentAttempt.update({
				where: { id: attemptB.id },
				data: { submittedAt: new Date(), integrityScore: 40 },
			});

			const attempts = await service.listAttempts(
				asAuthenticatedUser(ownerId),
				assessment.id,
			);
			expect(attempts.map((a) => a.id)).toEqual([attemptB.id, attemptA.id]);
		});

		it("invalidates, then accepts, an attempt", async () => {
			const course = await prisma.course.create({
				data: {
					title: "Course",
					slug: "invalidate-course",
					createdBy: ownerId,
				},
			});
			const assessment = await service.createAssessment(
				asAuthenticatedUser(ownerId),
				{ scope: "course_final", courseId: course.id },
			);
			const learner = await createUser(prisma, { role: "learner" });
			const attempt = await createAssessmentAttempt(prisma, {
				assessmentId: assessment.id,
				userId: learner.id,
				passed: true,
			});

			await service.invalidateAttempt(
				asAuthenticatedUser(ownerId),
				attempt.id,
				"suspicious activity",
			);
			let refreshed = await prisma.assessmentAttempt.findUnique({
				where: { id: attempt.id },
			});
			expect(refreshed?.invalidated).toBe(true);

			await service.acceptAttempt(asAuthenticatedUser(ownerId), attempt.id);
			refreshed = await prisma.assessmentAttempt.findUnique({
				where: { id: attempt.id },
			});
			expect(refreshed?.invalidated).toBe(false);
		});

		it("restricts listAllIntegrityReports to admins", async () => {
			await expect(
				service.listAllIntegrityReports(asAuthenticatedUser(ownerId)),
			).rejects.toThrow(ForbiddenException);
			await expect(
				service.listAllIntegrityReports(asAuthenticatedUser(adminId, "admin")),
			).resolves.toBeInstanceOf(Array);
		});
	});
});
