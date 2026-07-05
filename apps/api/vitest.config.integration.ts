import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Service/integration tests (Phase C): real `PrismaService` against the
 * disposable `dextalearning_test` Postgres database (see `TEST_DATABASE_URL`
 * in .env, provisioned via `bun run db:test:push`), fake `StoragePort`/`AiPort`
 * adapters. Separate from `vitest.config.ts` (infra-free unit tests) and
 * `vitest.config.e2e.ts` (full HTTP app via supertest) — this layer
 * constructs services directly, no Nest bootstrap, no HTTP.
 */
export default defineConfig({
	oxc: false,
	test: {
		environment: "node",
		globals: false,
		include: ["test/integration/**/*.integration-spec.ts"],
		exclude: ["**/node_modules/**"],
		setupFiles: ["./test/integration/setup.ts"],
		testTimeout: 20_000,
		hookTimeout: 20_000,
		// All specs share ONE physical test DB and TRUNCATE it in `beforeEach`
		// (support/reset-db.ts) — running spec files in parallel means one
		// file's reset can wipe another file's fixtures mid-test. Must be serial.
		fileParallelism: false,
	},
	plugins: [
		swc.vite({
			module: { type: "es6" },
		}),
	],
});
