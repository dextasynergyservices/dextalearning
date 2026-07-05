import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Unit tests (blueprint tech-stack: Vitest). Pure `lib/` logic (`.spec.ts`)
 * runs on `environment: "node"` (no DOM needed, faster). Component tests
 * (`.spec.tsx`, Phase E) opt into jsdom per-file via a `// @vitest-environment
 * jsdom` docblock as their first line — Vitest 4 dropped `environmentMatchGlob`
 * (superseded by the `projects` config for multi-environment setups, which
 * would be overkill here for one glob), so the per-file docblock is the
 * supported way to keep fast pure-logic specs off jsdom.
 */
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		environment: "node",
		globals: false,
		// Comfortably above setup.ts's asyncUtilTimeout (5000ms) — otherwise a
		// waitFor/findBy* that's genuinely still retrying can lose the race to
		// this outer per-test timeout and fail as an opaque "Test timed out"
		// instead of the specific assertion error underneath it.
		testTimeout: 15000,
		setupFiles: ["./src/test/setup.ts"],
		include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
		exclude: ["**/node_modules/**", "**/*.e2e.spec.ts"],
		coverage: {
			provider: "v8",
			reportsDirectory: "./coverage",
			include: ["src/**/*.ts", "src/**/*.tsx"],
			exclude: [
				"src/**/*.spec.ts",
				"src/**/*.spec.tsx",
				"src/routeTree.gen.ts",
			],
		},
	},
});
