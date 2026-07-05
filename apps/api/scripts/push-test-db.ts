/**
 * Sync `dextalearning_test`'s schema from prisma/schema.prisma (Phase C
 * integration tests). Disposable DB, so `db push` is fine — no migration
 * history needed. Re-run whenever schema.prisma changes.
 */
import { execSync } from "node:child_process";
import "dotenv/config";

if (!process.env.TEST_DATABASE_URL) {
	throw new Error(
		"TEST_DATABASE_URL is not set. Add it to apps/api/.env (see .env.example).",
	);
}

execSync(
	`bunx prisma db push --url="${process.env.TEST_DATABASE_URL}" --accept-data-loss`,
	{ stdio: "inherit" },
);
