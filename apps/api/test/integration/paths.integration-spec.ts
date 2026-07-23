import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { PathsService } from "../../src/modules/content/paths.service";
import { TenantService } from "../../src/modules/tenant/tenant.service";
import { getTestPrisma } from "./support/db";
import { createCourse, createUser } from "./support/factories";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

function asAuthenticatedUser(
	id: string,
	role: AuthenticatedUser["role"] = "instructor",
): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role };
}

describe("PathsService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new PathsService(
		prisma,
		new FakeStorageAdapter(),
		new TenantService(prisma),
	);

	let ownerId: string;
	let otherId: string;
	let adminId: string;

	beforeEach(async () => {
		ownerId = (await createUser(prisma, { role: "instructor" })).id;
		otherId = (await createUser(prisma, { role: "instructor" })).id;
		adminId = (await createUser(prisma, { role: "admin" })).id;
	});

	it("createPath creates a draft path owned by the caller", async () => {
		const path = await service.createPath(asAuthenticatedUser(ownerId), {
			title: "New Path",
		});
		expect(path.status).toBe("draft");
		expect(path.createdBy).toBe(ownerId);
	});

	describe("listMine", () => {
		it("scopes instructors to their own paths, but shows admins everything", async () => {
			const owned = await prisma.learningPath.create({
				data: { title: "Owner path", slug: "owner-path", createdBy: ownerId },
			});
			await prisma.learningPath.create({
				data: { title: "Other path", slug: "other-path", createdBy: otherId },
			});

			const ownerList = await service.listMine(asAuthenticatedUser(ownerId));
			expect(ownerList.map((p) => p.id)).toEqual([owned.id]);

			const adminList = await service.listMine(
				asAuthenticatedUser(adminId, "admin"),
			);
			expect(adminList.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("ownership gating", () => {
		it("forbids a non-owner instructor from editing another instructor's path", async () => {
			const path = await prisma.learningPath.create({
				data: {
					title: "Private path",
					slug: "private-path",
					createdBy: ownerId,
				},
			});
			await expect(
				service.getPathForEdit(asAuthenticatedUser(otherId), path.id),
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("updatePath", () => {
		it("ignores isFeatured from a non-admin instructor", async () => {
			const path = await prisma.learningPath.create({
				data: {
					title: "Feature test",
					slug: "feature-test",
					createdBy: ownerId,
				},
			});
			const updated = await service.updatePath(
				asAuthenticatedUser(ownerId),
				path.id,
				{ isFeatured: true },
			);
			expect(updated.isFeatured).toBe(false);
		});

		it("applies isFeatured when set by an admin, clearing any pending request", async () => {
			const path = await prisma.learningPath.create({
				data: {
					title: "Feature test",
					slug: "feature-test-2",
					createdBy: ownerId,
					featureRequested: true,
				},
			});
			const updated = await service.updatePath(
				asAuthenticatedUser(adminId, "admin"),
				path.id,
				{ isFeatured: true },
			);
			expect(updated.isFeatured).toBe(true);
			expect(updated.featureRequested).toBe(false);
		});

		it("defaults Earn-Back percentage to 100 when enabled without an explicit value", async () => {
			const path = await prisma.learningPath.create({
				data: { title: "Earn back", slug: "earn-back", createdBy: ownerId },
			});
			const updated = await service.updatePath(
				asAuthenticatedUser(ownerId),
				path.id,
				{ isEarnBackEligible: true },
			);
			expect(updated.isEarnBackEligible).toBe(true);
			expect(updated.earnBackPercentage).toBe(100);
		});
	});

	describe("course membership", () => {
		it("auto-increments orderIndex and removes a course cleanly", async () => {
			const path = await prisma.learningPath.create({
				data: {
					title: "With courses",
					slug: "with-courses",
					createdBy: ownerId,
				},
			});
			const c1 = await createCourse(prisma);
			const c2 = await createCourse(prisma);

			await service.addCourse(asAuthenticatedUser(ownerId), path.id, c1.id);
			await service.addCourse(asAuthenticatedUser(ownerId), path.id, c2.id);

			const links = await prisma.pathCourse.findMany({
				where: { pathId: path.id },
				orderBy: { orderIndex: "asc" },
			});
			expect(links.map((l) => l.courseId)).toEqual([c1.id, c2.id]);
			expect(links.map((l) => l.orderIndex)).toEqual([1, 2]);

			await service.removeCourse(asAuthenticatedUser(ownerId), path.id, c1.id);
			const remaining = await prisma.pathCourse.findMany({
				where: { pathId: path.id },
			});
			expect(remaining.map((l) => l.courseId)).toEqual([c2.id]);
		});

		it("reorders courses", async () => {
			const path = await prisma.learningPath.create({
				data: { title: "Reorder", slug: "reorder-path", createdBy: ownerId },
			});
			const c1 = await createCourse(prisma);
			const c2 = await createCourse(prisma);
			await service.addCourse(asAuthenticatedUser(ownerId), path.id, c1.id);
			await service.addCourse(asAuthenticatedUser(ownerId), path.id, c2.id);

			await service.reorderCourses(asAuthenticatedUser(ownerId), path.id, [
				c2.id,
				c1.id,
			]);
			const links = await prisma.pathCourse.findMany({
				where: { pathId: path.id },
				orderBy: { orderIndex: "asc" },
			});
			expect(links.map((l) => l.courseId)).toEqual([c2.id, c1.id]);
		});
	});

	describe("publishPath", () => {
		it("rejects publishing a path with no courses", async () => {
			const path = await prisma.learningPath.create({
				data: { title: "Empty path", slug: "empty-path", createdBy: ownerId },
			});
			await expect(
				service.publishPath(asAuthenticatedUser(ownerId), path.id),
			).rejects.toThrow("Add at least one course before publishing.");
		});

		it("publishes once at least one course is attached", async () => {
			const path = await prisma.learningPath.create({
				data: { title: "Ready path", slug: "ready-path", createdBy: ownerId },
			});
			const course = await createCourse(prisma);
			await service.addCourse(asAuthenticatedUser(ownerId), path.id, course.id);
			const published = await service.publishPath(
				asAuthenticatedUser(ownerId),
				path.id,
			);
			expect(published.status).toBe("published");
		});
	});

	describe("intro lesson", () => {
		it("createIntro is idempotent — calling it twice returns the same lesson", async () => {
			const path = await prisma.learningPath.create({
				data: { title: "Intro path", slug: "intro-path", createdBy: ownerId },
			});
			const first = await service.createIntro(
				asAuthenticatedUser(ownerId),
				path.id,
			);
			const second = await service.createIntro(
				asAuthenticatedUser(ownerId),
				path.id,
			);
			expect(second.id).toBe(first.id);
			const count = await prisma.lesson.count({
				where: { introForPathId: path.id },
			});
			expect(count).toBe(1);
		});

		it("removeIntro deletes the intro lesson", async () => {
			const path = await prisma.learningPath.create({
				data: { title: "Intro path", slug: "intro-path-2", createdBy: ownerId },
			});
			await service.createIntro(asAuthenticatedUser(ownerId), path.id);
			await service.removeIntro(asAuthenticatedUser(ownerId), path.id);
			const count = await prisma.lesson.count({
				where: { introForPathId: path.id },
			});
			expect(count).toBe(0);
		});
	});
});
