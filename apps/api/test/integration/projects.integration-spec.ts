import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { ProjectsService } from "../../src/modules/projects/projects.service";
import { getTestPrisma } from "./support/db";
import {
	createCohort,
	createProjectSubmission,
	createUser,
} from "./support/factories";
import { FakeAiAdapter } from "./support/fakes/fake-ai.adapter";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

function asAuthenticatedUser(
	id: string,
	role: AuthenticatedUser["role"] = "instructor",
): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role };
}

describe("ProjectsService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new ProjectsService(
		prisma,
		new FakeStorageAdapter(),
		new FakeAiAdapter(),
	);

	let ownerId: string;
	let otherId: string;
	let adminId: string;

	beforeEach(async () => {
		ownerId = (await createUser(prisma, { role: "instructor" })).id;
		otherId = (await createUser(prisma, { role: "instructor" })).id;
		adminId = (await createUser(prisma, { role: "admin" })).id;
	});

	describe("createProject + ownership", () => {
		it("requires the parent id matching the scope", async () => {
			await expect(
				service.createProject(asAuthenticatedUser(ownerId), {
					scope: "course",
					title: "No parent",
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("forbids a non-owner instructor from creating a course-scoped project", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "proj-course", createdBy: ownerId },
			});
			await expect(
				service.createProject(asAuthenticatedUser(otherId), {
					scope: "course",
					title: "Sneaky",
					courseId: course.id,
				}),
			).rejects.toThrow(ForbiddenException);
		});

		it("cohort-scoped projects are admin-only", async () => {
			const cohort = await createCohort(prisma);
			await expect(
				service.createProject(asAuthenticatedUser(ownerId), {
					scope: "cohort",
					title: "Cohort project",
					cohortId: cohort.id,
				}),
			).rejects.toThrow(ForbiddenException);
			const project = await service.createProject(
				asAuthenticatedUser(adminId, "admin"),
				{ scope: "cohort", title: "Cohort project", cohortId: cohort.id },
			);
			expect(project.cohortId).toBe(cohort.id);
		});

		it("auto-increments orderIndex per parent", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "proj-order", createdBy: ownerId },
			});
			const p1 = await service.createProject(asAuthenticatedUser(ownerId), {
				scope: "course",
				title: "P1",
				courseId: course.id,
			});
			const p2 = await service.createProject(asAuthenticatedUser(ownerId), {
				scope: "course",
				title: "P2",
				courseId: course.id,
			});
			expect(p1.orderIndex).toBe(1);
			expect(p2.orderIndex).toBe(2);
		});
	});

	describe("updateProject", () => {
		it("normalizes the rubric (auto-generating missing criterion ids) and converts dueAt", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "proj-update", createdBy: ownerId },
			});
			const project = await service.createProject(
				asAuthenticatedUser(ownerId),
				{
					scope: "course",
					title: "Graded project",
					courseId: course.id,
				},
			);
			const updated = await service.updateProject(
				asAuthenticatedUser(ownerId),
				project.id,
				{
					dueAt: "2026-10-01T00:00:00.000Z",
					rubric: [{ label: "Clarity", maxPoints: 50 }],
				},
			);
			expect(updated.dueAt?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
			const rubric = updated.rubricJson as { id: string; label: string }[];
			expect(rubric).toHaveLength(1);
			expect(rubric[0].label).toBe("Clarity");
			expect(rubric[0].id).toBeTruthy();
		});
	});

	describe("grading", () => {
		it("derives the score from rubric points when no explicit score is given", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "proj-grade", createdBy: ownerId },
			});
			const project = await service.createProject(
				asAuthenticatedUser(ownerId),
				{
					scope: "course",
					title: "Graded project",
					courseId: course.id,
				},
			);
			await service.updateProject(asAuthenticatedUser(ownerId), project.id, {
				rubric: [
					{ id: "clarity", label: "Clarity", maxPoints: 50 },
					{ id: "correctness", label: "Correctness", maxPoints: 50 },
				],
				passMark: 70,
			});
			const learner = await createUser(prisma, { role: "learner" });
			const submission = await createProjectSubmission(prisma, {
				projectId: project.id,
				userId: learner.id,
				passed: false,
			});
			const graded = await service.gradeSubmission(
				asAuthenticatedUser(ownerId),
				submission.id,
				{
					rubricScores: [
						{ criterionId: "clarity", points: 40 },
						{ criterionId: "correctness", points: 45 },
					],
				},
			);
			// (40+45)/100 = 85%
			expect(graded.score).toBe(85);
			expect(graded.passed).toBe(true);
		});

		it("respects an explicit score over rubric-derived scoring", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "proj-grade-2", createdBy: ownerId },
			});
			const project = await service.createProject(
				asAuthenticatedUser(ownerId),
				{
					scope: "course",
					title: "Graded project",
					courseId: course.id,
				},
			);
			const learner = await createUser(prisma, { role: "learner" });
			const submission = await createProjectSubmission(prisma, {
				projectId: project.id,
				userId: learner.id,
				passed: false,
			});
			const graded = await service.gradeSubmission(
				asAuthenticatedUser(ownerId),
				submission.id,
				{ score: 55, passed: false },
			);
			expect(graded.score).toBe(55);
			expect(graded.passed).toBe(false);
		});

		it("aiDraftGrade rejects a submission with no content to grade", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "proj-ai", createdBy: ownerId },
			});
			const project = await service.createProject(
				asAuthenticatedUser(ownerId),
				{
					scope: "course",
					title: "AI project",
					courseId: course.id,
				},
			);
			const learner = await createUser(prisma, { role: "learner" });
			const submission = await prisma.projectSubmission.create({
				data: { projectId: project.id, userId: learner.id },
			});
			await expect(
				service.aiDraftGrade(asAuthenticatedUser(ownerId), submission.id),
			).rejects.toThrow(BadRequestException);
		});

		it("aiDraftGrade returns a full-marks draft from the fake AI adapter", async () => {
			const course = await prisma.course.create({
				data: { title: "Course", slug: "proj-ai-2", createdBy: ownerId },
			});
			const project = await service.createProject(
				asAuthenticatedUser(ownerId),
				{
					scope: "course",
					title: "AI project",
					courseId: course.id,
				},
			);
			await service.updateProject(asAuthenticatedUser(ownerId), project.id, {
				rubric: [{ id: "quality", label: "Quality", maxPoints: 100 }],
			});
			const learner = await createUser(prisma, { role: "learner" });
			const submission = await prisma.projectSubmission.create({
				data: {
					projectId: project.id,
					userId: learner.id,
					textContent: "My submission text.",
				},
			});
			const draft = await service.aiDraftGrade(
				asAuthenticatedUser(ownerId),
				submission.id,
			);
			expect(draft.scores).toEqual([
				{
					criterionId: "quality",
					points: 100,
					comment: "Fake grade: full marks.",
				},
			]);
		});
	});
});
