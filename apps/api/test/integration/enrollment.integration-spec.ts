import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { EnrollmentService } from "../../src/modules/enrollment/enrollment.service";
import { getTestPrisma } from "./support/db";
import {
	createCohort,
	createCourse,
	createPath,
	createUser,
} from "./support/factories";

function asAuthenticatedUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "learner" };
}

describe("EnrollmentService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new EnrollmentService(prisma);

	let learnerId: string;

	beforeEach(async () => {
		const learner = await createUser(prisma, { role: "learner" });
		learnerId = learner.id;
	});

	describe("course enrolment", () => {
		it("rejects enrolling in a draft course", async () => {
			const course = await createCourse(prisma, { status: "draft" });
			await expect(
				service.enroll(asAuthenticatedUser(learnerId), "course", course.id),
			).rejects.toThrow(NotFoundException);
		});

		it("enrolls in a published course and reports isEnrolled=true", async () => {
			const course = await createCourse(prisma, { status: "published" });
			expect(await service.isEnrolled(learnerId, "course", course.id)).toBe(
				false,
			);
			const result = await service.enroll(
				asAuthenticatedUser(learnerId),
				"course",
				course.id,
			);
			expect(result).toEqual({ enrolled: true });
			expect(await service.isEnrolled(learnerId, "course", course.id)).toBe(
				true,
			);
			expect(
				await service.getStatus(
					asAuthenticatedUser(learnerId),
					"course",
					course.id,
				),
			).toEqual({ enrolled: true });
		});

		it("is idempotent — enrolling twice doesn't throw or duplicate", async () => {
			const course = await createCourse(prisma, { status: "published" });
			await service.enroll(asAuthenticatedUser(learnerId), "course", course.id);
			await service.enroll(asAuthenticatedUser(learnerId), "course", course.id);
			const count = await prisma.courseEnrollment.count({
				where: { courseId: course.id, userId: learnerId },
			});
			expect(count).toBe(1);
		});
	});

	describe("path enrolment", () => {
		it("rejects enrolling in a non-published path", async () => {
			const path = await createPath(prisma, { status: "archived" });
			await expect(
				service.enroll(asAuthenticatedUser(learnerId), "path", path.id),
			).rejects.toThrow(NotFoundException);
		});

		it("enrolls in a published path", async () => {
			const path = await createPath(prisma, { status: "published" });
			await service.enroll(asAuthenticatedUser(learnerId), "path", path.id);
			expect(await service.isEnrolled(learnerId, "path", path.id)).toBe(true);
		});
	});

	describe("cohort enrolment", () => {
		it("rejects enrolling in a closed cohort", async () => {
			const cohort = await createCohort(prisma, { status: "closed" });
			await expect(
				service.enroll(asAuthenticatedUser(learnerId), "cohort", cohort.id),
			).rejects.toThrow(NotFoundException);
		});

		it("enrolls in an open cohort", async () => {
			const cohort = await createCohort(prisma, { status: "open" });
			await service.enroll(asAuthenticatedUser(learnerId), "cohort", cohort.id);
			expect(await service.isEnrolled(learnerId, "cohort", cohort.id)).toBe(
				true,
			);
		});
	});

	it("reports isEnrolled=false for an item that doesn't exist", async () => {
		expect(
			await service.isEnrolled(
				learnerId,
				"course",
				"00000000-0000-0000-0000-000000000000",
			),
		).toBe(false);
	});

	it("parseType rejects an unknown enrolment type", () => {
		expect(() => service.parseType("bogus")).toThrow();
		expect(service.parseType("course")).toBe("course");
	});
});
