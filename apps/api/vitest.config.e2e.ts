import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * E2E tests: boot a real Nest app (full DI graph, I/O ports swapped for Phase
 * C's fakes) against the disposable `dextalearning_test` Postgres database and
 * hit it over HTTP via supertest. Run with `bun run test:e2e` — kept separate
 * from `vitest.config.ts` so the fast unit-test loop never needs the DB.
 */
export default defineConfig({
	// unplugin-swc replaces Vite's default TS transform; Vite 7's Oxc-based
	// transform must be explicitly disabled too (its own `esbuild: false`
	// only covered the older esbuild path).
	oxc: false,
	test: {
		environment: "node",
		globals: false,
		include: ["test/**/*.e2e-spec.ts"],
		exclude: ["**/node_modules/**"],
		setupFiles: ["./test/e2e/setup.ts"],
		// e2e specs boot a full Nest app + hit real infra — give them more room
		// than the default unit-test timeout.
		testTimeout: 30_000,
		hookTimeout: 30_000,
		// All specs share ONE physical test DB and TRUNCATE it between tests
		// (see support/reset-db.ts, reused from Phase C) — parallel file
		// execution would let one file's reset wipe another's fixtures mid-test.
		fileParallelism: false,
	},
	plugins: [
		swc.vite({
			module: { type: "es6" },
			// e2e tests transitively import .tsx (React Email templates via
			// auth.config.ts -> common/email.ts -> emails/render.tsx). tsconfig.json
			// uses the automatic "react-jsx" runtime (no `React` import needed), but
			// unplugin-swc defaults to the classic transform — mismatch throws
			// "React is not defined" at render time. Match tsconfig's runtime.
			jsc: {
				transform: {
					react: {
						runtime: "automatic",
					},
				},
			},
		}),
	],
});
