import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { DropoffQueryService } from "../../src/modules/dropoff/dropoff-query.service";
import { TeachingService } from "../../src/modules/teaching/teaching.service";
import { getTestPrisma } from "./support/db";
import {
	createCohort,
	createCohortCourse,
	createCourse,
	createUser,
} from "./support/factories";

const asInstructor = (id: string): AuthenticatedUser => ({
	id,
	email: `${id}@example.com`,
	role: "instructor",
});

describe("TeachingService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new TeachingService(prisma, new DropoffQueryService(prisma));

	let cohortId: string;
	let instructorId: string;

	beforeEach(async () => {
		cohortId = (await createCohort(prisma)).id;
		instructorId = (await createUser(prisma, { role: "instructor" })).id;
		await prisma.cohortInstructor.create({
			data: { cohortId, userId: instructorId },
		});
	});

	it("lists the cohorts an instructor is assigned to teach, with counts", async () => {
		const course = await createCourse(prisma);
		await createCohortCourse(prisma, { cohortId, courseId: course.id });
		const learner = await createUser(prisma, { role: "learner" });
		await prisma.cohortEnrollment.create({
			data: { cohortId, userId: learner.id, status: "active" },
		});

		const mine = await service.myCohorts(asInstructor(instructorId));
		expect(mine).toHaveLength(1);
		expect(mine[0]).toMatchObject({
			id: cohortId,
			learnerCount: 1,
			courseCount: 1,
		});
	});

	it("returns a read-only detail with the roster and each learner's progress", async () => {
		const learner = await createUser(prisma, {
			role: "learner",
			firstName: "Ada",
			lastName: "Lovelace",
		});
		await prisma.cohortEnrollment.create({
			data: { cohortId, userId: learner.id, status: "active" },
		});
		await prisma.completionStatus.create({
			data: {
				userId: learner.id,
				entityType: "cohort",
				entityId: cohortId,
				progressPercent: 60,
				isComplete: false,
			},
		});

		const detail = await service.cohortDetail(
			asInstructor(instructorId),
			cohortId,
		);
		expect(detail.id).toBe(cohortId);
		expect(detail.learners).toHaveLength(1);
		expect(detail.learners[0]).toMatchObject({
			userId: learner.id,
			progressPercent: 60,
			completed: false,
		});
	});

	it("forbids an instructor who isn't assigned to the cohort", async () => {
		const other = await createUser(prisma, { role: "instructor" });
		await expect(
			service.cohortDetail(asInstructor(other.id), cohortId),
		).rejects.toThrow();
		expect(await service.myCohorts(asInstructor(other.id))).toEqual([]);
	});

	it("admits an admin to any cohort's teaching detail", async () => {
		const admin = await createUser(prisma, { role: "admin" });
		const detail = await service.cohortDetail(
			{ id: admin.id, email: "a@example.com", role: "admin" },
			cohortId,
		);
		expect(detail.id).toBe(cohortId);
	});

	it("404s for a missing cohort", async () => {
		await expect(
			service.cohortDetail(asInstructor(instructorId), instructorId),
		).rejects.toThrow();
	});
});
