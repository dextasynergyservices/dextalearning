import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { CatalogEventsHandler } from "../../src/modules/catalog/catalog.events-handler";
import { CatalogService } from "../../src/modules/catalog/catalog.service";
import { getTestPrisma } from "./support/db";
import { createCourse, createUser } from "./support/factories";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

describe("CatalogService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new CatalogService(prisma, new FakeStorageAdapter());

	describe("getFeatured", () => {
		it("only shows published, admin-featured courses", async () => {
			await createCourse(prisma, { status: "published" }); // not featured
			const featured = await prisma.course.create({
				data: {
					title: "Featured",
					slug: "featured-course",
					status: "published",
					isFeatured: true,
				},
			});
			await prisma.course.create({
				data: {
					title: "Draft featured",
					slug: "draft-featured",
					status: "draft",
					isFeatured: true,
				},
			});
			const result = await service.getFeatured();
			expect(result.courses.map((c) => c.id)).toEqual([featured.id]);
		});

		it("only shows open, admin-featured cohorts", async () => {
			await prisma.cohort.create({
				data: { title: "Closed", slug: "closed-cohort", status: "closed" },
			});
			const open = await prisma.cohort.create({
				data: {
					title: "Open",
					slug: "open-cohort",
					status: "open",
					isFeatured: true,
				},
			});
			const result = await service.getFeatured();
			expect(result.cohorts.map((c) => c.id)).toEqual([open.id]);
		});
	});

	describe("getRecommended", () => {
		it("excludes featured and already-enrolled courses", async () => {
			const learner = await createUser(prisma, { role: "learner" });
			const enrolled = await prisma.course.create({
				data: { title: "Enrolled", slug: "reco-enrolled", status: "published" },
			});
			await prisma.courseEnrollment.create({
				data: { courseId: enrolled.id, userId: learner.id },
			});
			await prisma.course.create({
				data: {
					title: "Featured",
					slug: "reco-featured",
					status: "published",
					isFeatured: true,
				},
			});
			const candidate = await prisma.course.create({
				data: {
					title: "Candidate",
					slug: "reco-candidate",
					status: "published",
				},
			});

			const result = await service.getRecommended(learner.id);
			expect(result.courses.map((c) => c.id)).toEqual([candidate.id]);
		});

		it("is not personalized for a logged-out (no userId) request", async () => {
			await createCourse(prisma, { status: "published" });
			const result = await service.getRecommended();
			expect(result.personalized.courses).toBe(false);
		});
	});

	describe("getFeatureRequests", () => {
		it("only lists published courses/paths with a pending feature request", async () => {
			await prisma.course.create({
				data: {
					title: "Requesting",
					slug: "feature-req",
					status: "published",
					featureRequested: true,
				},
			});
			await prisma.course.create({
				data: {
					title: "Not requesting",
					slug: "no-feature-req",
					status: "published",
				},
			});
			const result = await service.getFeatureRequests();
			expect(result).toHaveLength(1);
			expect(result[0].type).toBe("course");
		});
	});

	describe("social proof (Phase 4, §3.2)", () => {
		it("EnrollmentCreated for a course increments enrolledCount; paths/cohorts are ignored", async () => {
			const handler = new CatalogEventsHandler(prisma);
			const course = await createCourse(prisma, { status: "published" });

			await handler.onEnrollmentCreated({
				userId: "00000000-0000-0000-0000-000000000000",
				entityType: "course",
				entityId: course.id,
			});
			await handler.onEnrollmentCreated({
				userId: "00000000-0000-0000-0000-000000000000",
				entityType: "path",
				entityId: course.id,
			});

			const updated = await prisma.course.findUniqueOrThrow({
				where: { id: course.id },
			});
			expect(updated.enrolledCount).toBe(1);
		});

		it("cards and the public detail expose enrolledCount", async () => {
			const course = await createCourse(prisma, { status: "published" });
			await prisma.course.update({
				where: { id: course.id },
				data: { enrolledCount: 47 },
			});

			const cards = await service.listPublishedCourses();
			expect(cards.find((c) => c.id === course.id)?.enrolledCount).toBe(47);

			const detail = await service.getPublishedCourse(course.slug);
			expect(detail.enrolledCount).toBe(47);
		});
	});

	describe("published visibility gates", () => {
		it("listPublishedCourses excludes drafts", async () => {
			const published = await createCourse(prisma, { status: "published" });
			await createCourse(prisma, { status: "draft" });
			const result = await service.listPublishedCourses();
			expect(result.map((c) => c.id)).toEqual([published.id]);
		});

		it("getPublishedCourse 404s for a draft course", async () => {
			const course = await createCourse(prisma, { status: "draft" });
			await expect(service.getPublishedCourse(course.slug)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("getPublishedCourse returns the instructor profile for a published course", async () => {
			const instructor = await createUser(prisma, {
				role: "instructor",
				firstName: "Ada",
				lastName: "Lovelace",
			});
			const course = await prisma.course.create({
				data: {
					title: "With instructor",
					slug: "with-instructor",
					status: "published",
					createdBy: instructor.id,
				},
			});
			const result = await service.getPublishedCourse(course.slug);
			expect(result.instructor?.name).toBe("Ada Lovelace");
		});

		it("getPublishedInstructor 404s for a learner", async () => {
			const learner = await createUser(prisma, { role: "learner" });
			await expect(service.getPublishedInstructor(learner.id)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("getPublishedInstructor returns only their published courses", async () => {
			const instructor = await createUser(prisma, { role: "instructor" });
			await prisma.course.create({
				data: {
					title: "Published",
					slug: "instructor-published",
					status: "published",
					createdBy: instructor.id,
				},
			});
			await prisma.course.create({
				data: {
					title: "Draft",
					slug: "instructor-draft",
					status: "draft",
					createdBy: instructor.id,
				},
			});
			const result = await service.getPublishedInstructor(instructor.id);
			expect(result.courses).toHaveLength(1);
			expect(result.courses[0].slug).toBe("instructor-published");
		});

		it("listPublishedPaths excludes drafts", async () => {
			const published = await prisma.learningPath.create({
				data: {
					title: "Published path",
					slug: "pub-path",
					status: "published",
				},
			});
			await prisma.learningPath.create({
				data: { title: "Draft path", slug: "draft-path", status: "draft" },
			});
			const result = await service.listPublishedPaths();
			expect(result.map((p) => p.id)).toEqual([published.id]);
		});

		it("getPublishedPath 404s for a non-published path", async () => {
			const path = await prisma.learningPath.create({
				data: { title: "Draft", slug: "draft-path-2", status: "archived" },
			});
			await expect(service.getPublishedPath(path.slug)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("listPublishedCohorts only shows open cohorts", async () => {
			const open = await prisma.cohort.create({
				data: { title: "Open", slug: "open-cohort-list", status: "open" },
			});
			await prisma.cohort.create({
				data: { title: "Closed", slug: "closed-cohort-list", status: "closed" },
			});
			const result = await service.listPublishedCohorts();
			expect(result.map((c) => c.id)).toEqual([open.id]);
		});

		it("getPublishedCohort 404s when not open", async () => {
			const cohort = await prisma.cohort.create({
				data: { title: "Draft cohort", slug: "draft-cohort", status: "draft" },
			});
			await expect(service.getPublishedCohort(cohort.slug)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("listPublishedPosts + getPublishedPost only surface published posts", async () => {
			await prisma.blogPost.create({
				data: { title: "Draft post", slug: "draft-post", status: "draft" },
			});
			const published = await prisma.blogPost.create({
				data: {
					title: "Published post",
					slug: "published-post",
					status: "published",
				},
			});
			const list = await service.listPublishedPosts();
			expect(list.map((p) => p.id)).toEqual([published.id]);

			await expect(service.getPublishedPost("draft-post")).rejects.toThrow(
				NotFoundException,
			);
			await expect(
				service.getPublishedPost("published-post"),
			).resolves.toBeTruthy();
		});
	});
});
