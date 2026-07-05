import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { AuthoringService } from "../../src/modules/content/authoring.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

function asAuthenticatedUser(
	id: string,
	role: AuthenticatedUser["role"] = "instructor",
): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role };
}

describe("AuthoringService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new AuthoringService(prisma, new FakeStorageAdapter());

	let ownerId: string;
	let otherId: string;
	let adminId: string;

	beforeEach(async () => {
		ownerId = (await createUser(prisma, { role: "instructor" })).id;
		otherId = (await createUser(prisma, { role: "instructor" })).id;
		adminId = (await createUser(prisma, { role: "admin" })).id;
	});

	describe("createCourse", () => {
		it("creates a draft course owned by the caller, with normalized commercials", async () => {
			const course = await service.createCourse(asAuthenticatedUser(ownerId), {
				title: "Intro to Testing",
				isEarnBackEligible: true,
			});
			expect(course.status).toBe("draft");
			expect(course.createdBy).toBe(ownerId);
			expect(course.isEarnBackEligible).toBe(true);
			expect(course.earnBackPercentage).toBe(100); // normalizeCommercials default
		});

		it("dedupes the slug when two courses share a title", async () => {
			const a = await service.createCourse(asAuthenticatedUser(ownerId), {
				title: "Same Title",
			});
			const b = await service.createCourse(asAuthenticatedUser(ownerId), {
				title: "Same Title",
			});
			expect(a.slug).not.toBe(b.slug);
			expect(b.slug.startsWith(a.slug)).toBe(true);
		});
	});

	describe("listMine", () => {
		it("scopes instructors to their own courses, but shows admins everything", async () => {
			const ownedCourse = await prisma.course.create({
				data: {
					title: "Owner course",
					slug: "owner-course",
					createdBy: ownerId,
				},
			});
			await prisma.course.create({
				data: {
					title: "Other course",
					slug: "other-course",
					createdBy: otherId,
				},
			});

			const ownerList = await service.listMine(asAuthenticatedUser(ownerId));
			expect(ownerList.map((c) => c.id)).toEqual([ownedCourse.id]);

			const adminList = await service.listMine(
				asAuthenticatedUser(adminId, "admin"),
			);
			expect(adminList.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("ownership gating", () => {
		it("forbids a non-owner instructor from editing another instructor's course", async () => {
			const course = await prisma.course.create({
				data: {
					title: "Private course",
					slug: "private-course",
					createdBy: ownerId,
				},
			});
			await expect(
				service.getCourseForEdit(asAuthenticatedUser(otherId), course.id),
			).rejects.toThrow(ForbiddenException);
		});

		it("allows the owner and any admin to edit the course", async () => {
			const course = await prisma.course.create({
				data: {
					title: "Private course",
					slug: "private-course-2",
					createdBy: ownerId,
				},
			});
			await expect(
				service.getCourseForEdit(asAuthenticatedUser(ownerId), course.id),
			).resolves.toBeTruthy();
			await expect(
				service.getCourseForEdit(
					asAuthenticatedUser(adminId, "admin"),
					course.id,
				),
			).resolves.toBeTruthy();
		});
	});

	describe("updateCourse — featuring gating", () => {
		it("ignores isFeatured from a non-admin instructor", async () => {
			const course = await prisma.course.create({
				data: {
					title: "Feature test",
					slug: "feature-test",
					createdBy: ownerId,
				},
			});
			const updated = await service.updateCourse(
				asAuthenticatedUser(ownerId),
				course.id,
				{ isFeatured: true },
			);
			expect(updated.isFeatured).toBe(false);
		});

		it("applies isFeatured when set by an admin, clearing any pending request", async () => {
			const course = await prisma.course.create({
				data: {
					title: "Feature test",
					slug: "feature-test-2",
					createdBy: ownerId,
					featureRequested: true,
				},
			});
			const updated = await service.updateCourse(
				asAuthenticatedUser(adminId, "admin"),
				course.id,
				{ isFeatured: true },
			);
			expect(updated.isFeatured).toBe(true);
			expect(updated.featureRequested).toBe(false);
		});
	});

	describe("modules + lessons", () => {
		it("auto-increments module and lesson orderIndex", async () => {
			const course = await prisma.course.create({
				data: { title: "Ordering", slug: "ordering", createdBy: ownerId },
			});
			const mod1 = await service.createModule(
				asAuthenticatedUser(ownerId),
				course.id,
				{
					title: "Module 1",
				},
			);
			const mod2 = await service.createModule(
				asAuthenticatedUser(ownerId),
				course.id,
				{
					title: "Module 2",
				},
			);
			expect(mod1.orderIndex).toBe(1);
			expect(mod2.orderIndex).toBe(2);

			const lesson1 = await service.createLesson(
				asAuthenticatedUser(ownerId),
				mod1.id,
				{ title: "Lesson 1", contentType: "text" },
			);
			const lesson2 = await service.createLesson(
				asAuthenticatedUser(ownerId),
				mod1.id,
				{ title: "Lesson 2", contentType: "text" },
			);
			expect(lesson1.orderIndex).toBe(1);
			expect(lesson2.orderIndex).toBe(2);
		});

		it("forbids a non-owner from creating a module on someone else's course", async () => {
			const course = await prisma.course.create({
				data: { title: "Guarded", slug: "guarded", createdBy: ownerId },
			});
			await expect(
				service.createModule(asAuthenticatedUser(otherId), course.id, {
					title: "Sneaky module",
				}),
			).rejects.toThrow(ForbiddenException);
		});

		it("reorders lessons and rejects a mismatched lesson set", async () => {
			const course = await prisma.course.create({
				data: { title: "Reorder", slug: "reorder", createdBy: ownerId },
			});
			const mod = await service.createModule(
				asAuthenticatedUser(ownerId),
				course.id,
				{
					title: "Module",
				},
			);
			const l1 = await service.createLesson(
				asAuthenticatedUser(ownerId),
				mod.id,
				{
					title: "A",
					contentType: "text",
				},
			);
			const l2 = await service.createLesson(
				asAuthenticatedUser(ownerId),
				mod.id,
				{
					title: "B",
					contentType: "text",
				},
			);

			await service.reorderLessons(asAuthenticatedUser(ownerId), mod.id, [
				l2.id,
				l1.id,
			]);
			const reordered = await prisma.lesson.findMany({
				where: { moduleId: mod.id },
				orderBy: { orderIndex: "asc" },
			});
			expect(reordered.map((l) => l.id)).toEqual([l2.id, l1.id]);

			await expect(
				service.reorderLessons(asAuthenticatedUser(ownerId), mod.id, [l1.id]),
			).rejects.toThrow(BadRequestException);
		});
	});

	describe("publishCourse", () => {
		it("rejects publishing a course with no lessons", async () => {
			const course = await prisma.course.create({
				data: { title: "Empty", slug: "empty", createdBy: ownerId },
			});
			await expect(
				service.publishCourse(asAuthenticatedUser(ownerId), course.id),
			).rejects.toThrow("errors.content.not_publishable");
		});

		it("rejects publishing when a lesson is missing its transcript", async () => {
			const course = await prisma.course.create({
				data: {
					title: "No transcript",
					slug: "no-transcript",
					createdBy: ownerId,
				},
			});
			const mod = await service.createModule(
				asAuthenticatedUser(ownerId),
				course.id,
				{
					title: "Module",
				},
			);
			await service.updateLesson(
				asAuthenticatedUser(ownerId),
				(
					await service.createLesson(asAuthenticatedUser(ownerId), mod.id, {
						title: "Lesson",
						contentType: "text",
					})
				).id,
				{ contentText: "Body text" }, // no transcriptText set
			);
			await expect(
				service.publishCourse(asAuthenticatedUser(ownerId), course.id),
			).rejects.toThrow("errors.content.not_publishable");
		});

		it("publishes once every lesson has content + a transcript", async () => {
			const course = await prisma.course.create({
				data: { title: "Ready", slug: "ready", createdBy: ownerId },
			});
			const mod = await service.createModule(
				asAuthenticatedUser(ownerId),
				course.id,
				{
					title: "Module",
				},
			);
			const lesson = await service.createLesson(
				asAuthenticatedUser(ownerId),
				mod.id,
				{ title: "Lesson", contentType: "text" },
			);
			await prisma.lesson.update({
				where: { id: lesson.id },
				data: { contentText: "Body text", transcriptText: "Body text" },
			});
			const published = await service.publishCourse(
				asAuthenticatedUser(ownerId),
				course.id,
			);
			expect(published.status).toBe("published");
		});
	});

	describe("deleteCourse", () => {
		it("removes the course row", async () => {
			const course = await prisma.course.create({
				data: { title: "To delete", slug: "to-delete", createdBy: ownerId },
			});
			const result = await service.deleteCourse(
				asAuthenticatedUser(ownerId),
				course.id,
			);
			expect(result).toEqual({ deleted: true });
			expect(
				await prisma.course.findUnique({ where: { id: course.id } }),
			).toBeNull();
		});
	});
});
