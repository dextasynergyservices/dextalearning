import { beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_ACADEMY_SLUG,
	TenantService,
} from "../../src/modules/tenant/tenant.service";
import { getTestPrisma } from "./support/db";

describe("TenantService (integration)", () => {
	const prisma = getTestPrisma();
	const tenants = new TenantService(prisma);

	beforeEach(async () => {
		await Promise.all([
			prisma.tenant.create({
				data: {
					slug: DEFAULT_ACADEMY_SLUG,
					name: "Teacher Academy",
					brandingJson: { accent: "#1d4ed8" },
				},
			}),
			prisma.tenant.create({ data: { slug: "tech", name: "Tech Academy" } }),
		]);
		tenants.invalidate();
	});

	it("lists academies and resolves a slug → summary with branding", async () => {
		const all = await tenants.list();
		expect(all.map((a) => a.slug).sort()).toEqual(["teachers", "tech"]);
		const teachers = await tenants.getBySlug(DEFAULT_ACADEMY_SLUG);
		expect(teachers?.name).toBe("Teacher Academy");
		expect(teachers?.branding).toEqual({ accent: "#1d4ed8" });
	});

	it("resolves the default academy id (the MVP fallback)", async () => {
		const id = await tenants.defaultTenantId();
		const resolved = await tenants.resolveId(DEFAULT_ACADEMY_SLUG);
		expect(id).toBe(resolved);
		expect(id).toBeTruthy();
	});

	it("returns null for an unknown academy", async () => {
		expect(await tenants.resolveId("nope")).toBeNull();
		expect(await tenants.getBySlug("nope")).toBeNull();
	});

	it("invalidate() picks up a newly created academy", async () => {
		expect(await tenants.resolveId("late")).toBeNull(); // caches the miss
		await prisma.tenant.create({ data: { slug: "late", name: "Late" } });
		expect(await tenants.resolveId("late")).toBeNull(); // still cached
		tenants.invalidate();
		expect(await tenants.resolveId("late")).toBeTruthy();
	});
});
