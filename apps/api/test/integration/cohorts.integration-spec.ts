import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { CohortsService } from "../../src/modules/content/cohorts.service";
import { getTestPrisma } from "./support/db";
import { createCourse, createPath, createUser } from "./support/factories";

function asAuthenticatedUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "admin" };
}

const BOGUS_ID = "00000000-0000-0000-0000-000000000000";

describe("CohortsService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new CohortsService(prisma);

	let adminId: string;
	let instructorId: string;

	beforeEach(async () => {
		adminId = (await createUser(prisma, { role: "admin" })).id;
		instructorId = (await createUser(prisma, { role: "instructor" })).id;
	});

	it("createCohort creates a draft cohort owned by the caller", async () => {
		const cohort = await service.createCohort(asAuthenticatedUser(adminId), {
			title: "New Cohort",
		});
		expect(cohort.status).toBe("draft");
		expect(cohort.createdBy).toBe(adminId);
	});

	it("operating on a non-existent cohort throws NotFoundException", async () => {
		const course = await createCourse(prisma);
		await expect(service.addCourse(BOGUS_ID, course.id)).rejects.toThrow(
			NotFoundException,
		);
	});

	describe("course membership", () => {
		it("auto-increments orderIndex and removes a course cleanly", async () => {
			const cohort = await prisma.cohort.create({
				data: {
					title: "With courses",
					slug: "with-courses",
					createdBy: adminId,
				},
			});
			const c1 = await createCourse(prisma);
			const c2 = await createCourse(prisma);

			await service.addCourse(cohort.id, c1.id);
			await service.addCourse(cohort.id, c2.id);

			const links = await prisma.cohortCourse.findMany({
				where: { cohortId: cohort.id },
				orderBy: { orderIndex: "asc" },
			});
			expect(links.map((l) => l.courseId)).toEqual([c1.id, c2.id]);
			expect(links.map((l) => l.orderIndex)).toEqual([1, 2]);

			await service.removeCourse(cohort.id, c1.id);
			const remaining = await prisma.cohortCourse.findMany({
				where: { cohortId: cohort.id },
			});
			expect(remaining.map((l) => l.courseId)).toEqual([c2.id]);
		});

		it("reorders courses", async () => {
			const cohort = await prisma.cohort.create({
				data: { title: "Reorder", slug: "reorder-cohort", createdBy: adminId },
			});
			const c1 = await createCourse(prisma);
			const c2 = await createCourse(prisma);
			await service.addCourse(cohort.id, c1.id);
			await service.addCourse(cohort.id, c2.id);

			await service.reorderCourses(cohort.id, [c2.id, c1.id]);
			const links = await prisma.cohortCourse.findMany({
				where: { cohortId: cohort.id },
				orderBy: { orderIndex: "asc" },
			});
			expect(links.map((l) => l.courseId)).toEqual([c2.id, c1.id]);
		});
	});

	describe("path membership", () => {
		it("auto-increments orderIndex and removes a path cleanly", async () => {
			const cohort = await prisma.cohort.create({
				data: { title: "With paths", slug: "with-paths", createdBy: adminId },
			});
			const p1 = await createPath(prisma);
			const p2 = await createPath(prisma);

			await service.addPath(cohort.id, p1.id);
			await service.addPath(cohort.id, p2.id);

			const links = await prisma.cohortPath.findMany({
				where: { cohortId: cohort.id },
				orderBy: { orderIndex: "asc" },
			});
			expect(links.map((l) => l.pathId)).toEqual([p1.id, p2.id]);

			await service.removePath(cohort.id, p1.id);
			const remaining = await prisma.cohortPath.findMany({
				where: { cohortId: cohort.id },
			});
			expect(remaining.map((l) => l.pathId)).toEqual([p2.id]);
		});
	});

	describe("staff assignment", () => {
		it("assigning an instructor twice is idempotent", async () => {
			const cohort = await prisma.cohort.create({
				data: { title: "Staffed", slug: "staffed", createdBy: adminId },
			});
			await service.assignInstructor(
				asAuthenticatedUser(adminId),
				cohort.id,
				instructorId,
			);
			await service.assignInstructor(
				asAuthenticatedUser(adminId),
				cohort.id,
				instructorId,
			);
			const count = await prisma.cohortInstructor.count({
				where: { cohortId: cohort.id, userId: instructorId },
			});
			expect(count).toBe(1);
		});

		it("removes an assigned facilitator", async () => {
			const cohort = await prisma.cohort.create({
				data: { title: "Staffed 2", slug: "staffed-2", createdBy: adminId },
			});
			await service.assignFacilitator(
				asAuthenticatedUser(adminId),
				cohort.id,
				instructorId,
			);
			await service.removeFacilitator(cohort.id, instructorId);
			const count = await prisma.cohortFacilitator.count({
				where: { cohortId: cohort.id, userId: instructorId },
			});
			expect(count).toBe(0);
		});
	});

	describe("updateCohort", () => {
		it("defaults Earn-Back percentage to 100 and converts date strings", async () => {
			const cohort = await prisma.cohort.create({
				data: { title: "Update me", slug: "update-me", createdBy: adminId },
			});
			const updated = await service.updateCohort(cohort.id, {
				isEarnBackEligible: true,
				startsAt: "2026-08-01T00:00:00.000Z",
			});
			expect(updated.isEarnBackEligible).toBe(true);
			expect(updated.earnBackPercentage).toBe(100);
			expect(updated.startsAt?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
		});
	});

	describe("publishCohort", () => {
		it("rejects publishing without a start date or courses", async () => {
			const cohort = await prisma.cohort.create({
				data: { title: "Not ready", slug: "not-ready", createdBy: adminId },
			});
			await expect(service.publishCohort(cohort.id)).rejects.toThrow(
				"Set a start date and add at least one course first.",
			);
		});

		it("opens the cohort once it has a start date and a course", async () => {
			const cohort = await prisma.cohort.create({
				data: {
					title: "Ready",
					slug: "ready-cohort",
					createdBy: adminId,
					startsAt: new Date("2026-08-01"),
				},
			});
			const course = await createCourse(prisma);
			await service.addCourse(cohort.id, course.id);
			const published = await service.publishCohort(cohort.id);
			expect(published.status).toBe("open");
		});
	});
});
