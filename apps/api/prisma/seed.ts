import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Seed (blueprint §17.7 + §2.1 academies):
 *   - academies (tenants): `teachers` (Teacher Academy — the MVP) + `tech`
 *     (Tech Academy)
 *   - adopt legacy null-tenant content into the Teacher Academy
 *   - platform_settings rows
 *
 * Idempotent: uses upserts so it is safe to run repeatedly, from
 * `prisma migrate reset`, and against a fresh remote DB.
 */
// Per-academy branding (§2.1). `accent` themes the academy landing; `icon`
// names its lucide glyph. Copy (headline/tagline) stays in i18n so it localises.
const ACADEMIES: Array<{
	slug: string;
	name: string;
	branding: { accent: string; icon: string };
}> = [
	{
		slug: "teachers",
		name: "Teacher Academy",
		branding: { accent: "#1d4ed8", icon: "GraduationCap" },
	},
	{
		slug: "tech",
		name: "Tech Academy",
		branding: { accent: "#0d9488", icon: "Code2" },
	},
];

/**
 * A small set of published starter courses (+ a path) so the Tech Academy isn't
 * an empty shell before instructors add real content. Platform-owned (no
 * creator), free, idempotent by slug — safe to replace later. Lessons come with
 * the Monaco code-lesson work (D4); these are enough to populate the catalogue.
 */
const TECH_STARTER_COURSES = [
	{
		slug: "intro-to-python",
		title: "Introduction to Python",
		level: "beginner" as const,
		description:
			"Start coding with Python — variables, control flow, functions, and your first small programs.",
	},
	{
		slug: "web-development-fundamentals",
		title: "Web Development Fundamentals",
		level: "beginner" as const,
		description:
			"HTML, CSS and JavaScript from the ground up — build and style your first interactive web pages.",
	},
	{
		slug: "data-structures-and-algorithms",
		title: "Data Structures & Algorithms",
		level: "intermediate" as const,
		description:
			"The core toolkit every engineer needs — arrays, maps, trees, and how to reason about complexity.",
	},
];

async function seedTechStarterContent(techTenantId: string): Promise<void> {
	const courseIds: string[] = [];
	for (const c of TECH_STARTER_COURSES) {
		const course = await prisma.course.upsert({
			where: { slug: c.slug },
			update: { tenantId: techTenantId, status: "published" },
			create: {
				slug: c.slug,
				title: c.title,
				description: c.description,
				level: c.level,
				language: "en",
				status: "published",
				isFree: true,
				tenantId: techTenantId,
			},
			select: { id: true },
		});
		courseIds.push(course.id);
	}

	const path = await prisma.learningPath.upsert({
		where: { slug: "full-stack-developer-track" },
		update: { tenantId: techTenantId, status: "published" },
		create: {
			slug: "full-stack-developer-track",
			title: "Full-Stack Developer Track",
			description:
				"A guided path from your first line of code to shipping full-stack apps.",
			level: "beginner",
			status: "published",
			isFree: true,
			tenantId: techTenantId,
		},
		select: { id: true },
	});

	// Re-link the path's courses in order (idempotent).
	await prisma.pathCourse.deleteMany({ where: { pathId: path.id } });
	await prisma.pathCourse.createMany({
		data: courseIds.map((courseId, i) => ({
			pathId: path.id,
			courseId,
			orderIndex: i,
		})),
	});

	console.log(
		`✓ Tech Academy starter content: ${courseIds.length} courses + 1 path`,
	);
}

async function main(): Promise<void> {
	const tenantBySlug = new Map<string, { id: string; slug: string }>();
	for (const academy of ACADEMIES) {
		const t = await prisma.tenant.upsert({
			where: { slug: academy.slug },
			update: { name: academy.name, brandingJson: academy.branding },
			create: {
				slug: academy.slug,
				name: academy.name,
				brandingJson: academy.branding,
				settingsJson: {},
			},
		});
		tenantBySlug.set(t.slug, t);
		console.log(`✓ Academy ready: ${t.slug} (${t.name})`);
	}
	const teachers = tenantBySlug.get("teachers");
	const tech = tenantBySlug.get("tech");
	if (!teachers || !tech) throw new Error("academies missing after seed");
	const tenant = teachers;

	// Tenant isolation (§2.1, Phase 9): content created before academies were
	// scoped has a NULL tenant — invisible to every academy-scoped browse. Adopt
	// it into the Teacher Academy (the MVP it was built for). Idempotent.
	const adopted = await Promise.all([
		prisma.course.updateMany({
			where: { tenantId: null },
			data: { tenantId: tenant.id },
		}),
		prisma.learningPath.updateMany({
			where: { tenantId: null },
			data: { tenantId: tenant.id },
		}),
		prisma.cohort.updateMany({
			where: { tenantId: null },
			data: { tenantId: tenant.id },
		}),
		prisma.assessment.updateMany({
			where: { tenantId: null },
			data: { tenantId: tenant.id },
		}),
		prisma.project.updateMany({
			where: { tenantId: null },
			data: { tenantId: tenant.id },
		}),
		prisma.certificate.updateMany({
			where: { tenantId: null },
			data: { tenantId: tenant.id },
		}),
	]);
	const adoptedCount = adopted.reduce((n, r) => n + r.count, 0);
	if (adoptedCount > 0) {
		console.log(`✓ Adopted ${adoptedCount} orphaned rows into ${tenant.slug}`);
	}

	await seedTechStarterContent(tech.id);

	const settings: Array<{ key: string; value: string }> = [
		{ key: "earn_back_max_duration_days", value: "60" },
		{ key: "instructor_revenue_share_pct", value: "90" },
		{ key: "default_earn_back_percentage", value: "100" },
		{ key: "platform_fee_pct", value: "5" },
		{ key: "platform_name", value: "DextaLearning" },
		{ key: "platform_domain", value: "dextalearning.com" },
	];

	for (const setting of settings) {
		await prisma.platformSetting.upsert({
			where: { key: setting.key },
			update: { value: setting.value },
			create: setting,
		});
	}
	console.log(`✓ Platform settings ready: ${settings.length} keys`);
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (error) => {
		console.error("Seed failed:", error);
		await prisma.$disconnect();
		process.exit(1);
	});
