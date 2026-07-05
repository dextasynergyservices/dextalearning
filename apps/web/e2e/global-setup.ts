import path from "node:path";
import { config } from "dotenv";
import { Client } from "pg";
import { ensureTestVideo } from "./support/fixtures";

/**
 * Runs once before the suite. Loads TEST_DATABASE_URL from apps/api/.env
 * (apps/web has no DB env of its own) and wipes the disposable test DB to a
 * clean slate — same TRUNCATE-all-tables approach as
 * apps/api/test/integration/support/reset-db.ts, reimplemented here via raw
 * `pg` since apps/web doesn't have the Prisma client generated. Also
 * generates the synthetic video fixture media-upload.spec.ts needs.
 */
export default async function globalSetup(): Promise<void> {
	config({ path: path.resolve(process.cwd(), "../api/.env"), quiet: true });
	ensureTestVideo();

	if (!process.env.TEST_DATABASE_URL) {
		throw new Error(
			"TEST_DATABASE_URL is not set (expected in apps/api/.env). Playwright specs must never run against the main DATABASE_URL.",
		);
	}

	const client = new Client({
		connectionString: process.env.TEST_DATABASE_URL,
	});
	await client.connect();
	try {
		const { rows } = await client.query<{ tablename: string }>(
			`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
		);
		if (rows.length > 0) {
			const names = rows.map((r) => `"${r.tablename}"`).join(", ");
			await client.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
		}
	} finally {
		await client.end();
	}
}
