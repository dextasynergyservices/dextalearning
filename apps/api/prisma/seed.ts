import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Phase 0 seed (blueprint §17.7):
 *   - `teachers` tenant (Teacher Academy — the MVP)
 *   - platform_settings rows
 *
 * Idempotent: uses upserts so it is safe to run repeatedly and from
 * `prisma migrate reset`.
 */
async function main(): Promise<void> {
	const tenant = await prisma.tenant.upsert({
		where: { slug: "teachers" },
		update: {},
		create: {
			slug: "teachers",
			name: "Teacher Academy",
			settingsJson: {},
		},
	});
	console.log(`✓ Tenant ready: ${tenant.slug} (${tenant.name})`);

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
