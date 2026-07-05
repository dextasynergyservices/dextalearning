import type { PrismaService } from "../../../src/prisma/prisma.service";

/**
 * Wipe every table in the `public` schema between tests. `CASCADE` handles FK
 * ordering automatically, so this doesn't need to track the model dependency
 * graph by hand or be updated as schema.prisma grows.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
	const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
		`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
	);
	if (tables.length === 0) return;
	const names = tables.map((t) => `"${t.tablename}"`).join(", ");
	await prisma.$executeRawUnsafe(
		`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`,
	);
}
