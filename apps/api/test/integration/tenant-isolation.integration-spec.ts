import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { CatalogService } from "../../src/modules/catalog/catalog.service";
import { TenantService } from "../../src/modules/tenant/tenant.service";
import { getTestPrisma } from "./support/db";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

/**
 * Tenant isolation (Phase 9 · D1). Two academies each own content; browsing one
 * must never surface the other's, an unknown academy is a 404, and the global
 * (no-academy) view spans both — the behaviour the D5 suite will harden further.
 */
describe("Tenant isolation (integration)", () => {
	const prisma = getTestPrisma();
	const tenants = new TenantService(prisma);
	const catalog = new CatalogService(prisma, new FakeStorageAdapter(), tenants);

	const slugA = "iso-a";
	const slugB = "iso-b";
	const courseSlugA = "iso-course-a";
	const courseSlugB = "iso-course-b";

	// The harness truncates every table before each test (setup.ts), so build the
	// two academies + their content fresh here, then drop the tenant cache so the
	// service resolves the new ids.
	beforeEach(async () => {
		const [a, b] = await Promise.all([
			prisma.tenant.create({ data: { slug: slugA, name: "Academy A" } }),
			prisma.tenant.create({ data: { slug: slugB, name: "Academy B" } }),
		]);
		tenants.invalidate();
		await Promise.all([
			prisma.course.create({
				data: {
					title: "A course",
					slug: courseSlugA,
					status: "published",
					tenantId: a.id,
				},
			}),
			prisma.course.create({
				data: {
					title: "B course",
					slug: courseSlugB,
					status: "published",
					tenantId: b.id,
				},
			}),
		]);
	});

	it("resolves an academy slug → tenant id, and 404s the unknown", async () => {
		expect(await tenants.resolveId(slugA)).toBeTruthy();
		expect(await tenants.resolveId("no-such-academy")).toBeNull();
	});

	it("a scoped list returns ONLY that academy's content", async () => {
		const inA = await catalog.listPublishedCourses(slugA);
		const inB = await catalog.listPublishedCourses(slugB);
		expect(inA.some((c) => c.slug === courseSlugA)).toBe(true);
		expect(inA.some((c) => c.slug === courseSlugB)).toBe(false);
		expect(inB.some((c) => c.slug === courseSlugB)).toBe(true);
		expect(inB.some((c) => c.slug === courseSlugA)).toBe(false);
	});

	it("the global (no-academy) list spans both academies", async () => {
		const all = await catalog.listPublishedCourses();
		expect(all.some((c) => c.slug === courseSlugA)).toBe(true);
		expect(all.some((c) => c.slug === courseSlugB)).toBe(true);
	});

	it("a course detail is 404 when fetched under the WRONG academy", async () => {
		// Right academy → found.
		await expect(
			catalog.getPublishedCourse(courseSlugA, slugA),
		).resolves.toMatchObject({ slug: courseSlugA });
		// Wrong academy → not found (no cross-academy leak).
		await expect(
			catalog.getPublishedCourse(courseSlugA, slugB),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("an unknown academy is a 404, never a silent global fallback", async () => {
		await expect(
			catalog.listPublishedCourses("no-such-academy"),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	// ── D5: the same guarantee across EVERY catalogue surface ────────────────
	// Courses were covered above; a leak through paths, cohorts or the featured
	// shelf would be just as bad, so each one is asserted the same way.
	describe("every catalogue surface is scoped, not just courses", () => {
		let idA: string;
		let idB: string;

		beforeEach(async () => {
			idA = (await tenants.resolveId(slugA)) as string;
			idB = (await tenants.resolveId(slugB)) as string;
			await Promise.all([
				prisma.learningPath.create({
					data: {
						title: "A path",
						slug: "iso-path-a",
						status: "published",
						tenantId: idA,
					},
				}),
				prisma.learningPath.create({
					data: {
						title: "B path",
						slug: "iso-path-b",
						status: "published",
						tenantId: idB,
					},
				}),
				prisma.cohort.create({
					data: {
						title: "A cohort",
						slug: "iso-cohort-a",
						status: "open",
						tenantId: idA,
					},
				}),
				prisma.cohort.create({
					data: {
						title: "B cohort",
						slug: "iso-cohort-b",
						status: "open",
						tenantId: idB,
					},
				}),
			]);
		});

		it("scopes the path list and 404s a path under the wrong academy", async () => {
			const inA = await catalog.listPublishedPaths(slugA);
			expect(inA.map((p) => p.slug)).toContain("iso-path-a");
			expect(inA.map((p) => p.slug)).not.toContain("iso-path-b");

			await expect(
				catalog.getPublishedPath("iso-path-a", slugA),
			).resolves.toMatchObject({ slug: "iso-path-a" });
			await expect(
				catalog.getPublishedPath("iso-path-a", slugB),
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it("scopes the cohort list and 404s a cohort under the wrong academy", async () => {
			const inB = await catalog.listPublishedCohorts(slugB);
			expect(inB.map((c) => c.slug)).toContain("iso-cohort-b");
			expect(inB.map((c) => c.slug)).not.toContain("iso-cohort-a");

			await expect(
				catalog.getPublishedCohort("iso-cohort-b", slugA),
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it("scopes the featured shelf", async () => {
			await prisma.course.updateMany({
				where: { slug: { in: [courseSlugA, courseSlugB] } },
				data: { isFeatured: true },
			});
			const featuredA = await catalog.getFeatured(slugA);
			const slugs = [
				...featuredA.courses.map((c) => c.slug),
				...featuredA.paths.map((p) => p.slug),
				...featuredA.cohorts.map((c) => c.slug),
			];
			expect(slugs).toContain(courseSlugA);
			expect(slugs).not.toContain(courseSlugB);
		});

		it("the global view still spans both on every surface", async () => {
			const [paths, cohorts] = await Promise.all([
				catalog.listPublishedPaths(),
				catalog.listPublishedCohorts(),
			]);
			expect(paths.map((p) => p.slug)).toEqual(
				expect.arrayContaining(["iso-path-a", "iso-path-b"]),
			);
			expect(cohorts.map((c) => c.slug)).toEqual(
				expect.arrayContaining(["iso-cohort-a", "iso-cohort-b"]),
			);
		});

		it("rejects an unknown academy on paths and cohorts too", async () => {
			await expect(
				catalog.listPublishedPaths("no-such-academy"),
			).rejects.toBeInstanceOf(NotFoundException);
			await expect(
				catalog.listPublishedCohorts("no-such-academy"),
			).rejects.toBeInstanceOf(NotFoundException);
		});

		// The blog is deliberately platform-wide, not per-academy — asserted so a
		// future "scope everything" change can't quietly break it.
		it("keeps the blog global on purpose", async () => {
			await prisma.blogPost.create({
				data: {
					title: "Platform news",
					slug: "iso-post",
					status: "published",
					publishedAt: new Date(),
				},
			});
			const posts = await catalog.listPublishedPosts();
			expect(posts.map((p) => p.slug)).toContain("iso-post");
		});
	});

	// Draft/unpublished content must not appear in ANY academy view — otherwise
	// scoping would be the only thing standing between a draft and the public.
	it("never surfaces unpublished content, in any academy view", async () => {
		const idA = (await tenants.resolveId(slugA)) as string;
		await prisma.course.create({
			data: {
				title: "A draft",
				slug: "iso-draft-a",
				status: "draft",
				tenantId: idA,
			},
		});
		const [scoped, global] = await Promise.all([
			catalog.listPublishedCourses(slugA),
			catalog.listPublishedCourses(),
		]);
		expect(scoped.map((c) => c.slug)).not.toContain("iso-draft-a");
		expect(global.map((c) => c.slug)).not.toContain("iso-draft-a");
		await expect(
			catalog.getPublishedCourse("iso-draft-a", slugA),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	// The cache is what makes tenant resolution cheap; a stale entry would send
	// a request to the WRONG tenant, so invalidation is part of the contract.
	it("resolves a newly created academy after the cache is invalidated", async () => {
		expect(await tenants.resolveId("iso-late")).toBeNull();
		await prisma.tenant.create({
			data: { slug: "iso-late", name: "Late Academy" },
		});
		tenants.invalidate();
		expect(await tenants.resolveId("iso-late")).toBeTruthy();
	});
});
