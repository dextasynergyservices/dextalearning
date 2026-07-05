/**
 * Starts the API against the disposable `dextalearning_test` DB instead of
 * the main dev DB — for Playwright (Phase F) to drive against, without ever
 * risking the main DATABASE_URL. Same port as `bun run dev`, so only one of
 * the two should run at a time (mirrors Vitest's integration/e2e layers,
 * which have the same one-DB-at-a-time relationship with TEST_DATABASE_URL).
 *
 * The env override must land before `./main` (and its static import of
 * `auth.config.ts`, which constructs a top-level PrismaClient off
 * `process.env.DATABASE_URL`) is evaluated — hence the dynamic `import()`
 * below instead of a static one.
 */
import "dotenv/config";

if (!process.env.TEST_DATABASE_URL) {
	throw new Error(
		"TEST_DATABASE_URL is not set. Add it to apps/api/.env (see .env.example).",
	);
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

import("../src/main.js");
