import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { AuthoringService } from "../../src/modules/content/authoring.service";
import { CohortsService } from "../../src/modules/content/cohorts.service";
import { PathsService } from "../../src/modules/content/paths.service";
import type { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { TenantService } from "../../src/modules/tenant/tenant.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

const asUser = (id: string): AuthenticatedUser => ({
	id,
	email: `${id}@example.com`,
	role: "instructor",
});

/**
 * Academy selection at authoring (Phase 9). A creator picks the academy for a
 * course/path/cohort; content is never orphaned or silently mis-filed. (Lessons,
 * assessments and projects inherit their parent's academy — covered by the code
 * that reads the parent's tenant.)
 */
describe("Academy authoring (integration)", () => {
	const prisma = getTestPrisma();
	const tenants = new TenantService(prisma);
	const storage = new FakeStorageAdapter();
	// §8.6 notices are best-effort side effects; these specs are about tenancy.
	const notifications = {
		notify: async () => {},
	} as unknown as NotificationsService;
	const authoring = new AuthoringService(
		prisma,
		storage,
		tenants,
		notifications,
	);
	const paths = new PathsService(prisma, storage, tenants);
	const cohorts = new CohortsService(prisma, tenants, notifications);

	let user: AuthenticatedUser;
	let techId: string;
	let teachersId: string;

	beforeEach(async () => {
		const [teachers, tech] = await Promise.all([
			prisma.tenant.create({ data: { slug: "teachers", name: "Teacher" } }),
			prisma.tenant.create({ data: { slug: "tech", name: "Tech" } }),
		]);
		teachersId = teachers.id;
		techId = tech.id;
		tenants.invalidate();
		user = asUser((await createUser(prisma, { role: "instructor" })).id);
	});

	it("assigns the chosen academy to a new course", async () => {
		const course = await authoring.createCourse(user, {
			title: "Intro to Rust",
			academy: "tech",
		});
		expect(course.tenantId).toBe(techId);
	});

	it("defaults to the Teacher Academy when no academy is chosen", async () => {
		const course = await authoring.createCourse(user, {
			title: "Pedagogy 101",
		});
		expect(course.tenantId).toBe(teachersId);
	});

	it("404s an unknown academy rather than mis-filing", async () => {
		await expect(
			authoring.createCourse(user, { title: "X", academy: "nope" }),
		).rejects.toBeInstanceOf(NotFoundException);
	});

	it("applies the chosen academy to paths and cohorts too", async () => {
		const path = await paths.createPath(user, {
			title: "Full-Stack",
			academy: "tech",
		});
		const cohort = await cohorts.createCohort(user, {
			title: "Jan Cohort",
			academy: "tech",
		});
		expect(path.tenantId).toBe(techId);
		expect(cohort.tenantId).toBe(techId);
	});
});
