import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Unit/service tests (blueprint tech-stack: Vitest). Uses `unplugin-swc`
 * instead of esbuild's TS transform because esbuild does NOT implement
 * `emitDecoratorMetadata` — NestJS's DI relies on it to resolve constructor
 * parameter types (e.g. `constructor(private readonly prisma: PrismaService)`)
 * when no explicit `@Inject()` token is given. SWC's decorator transform
 * supports it, matching NestJS's own documented Vitest setup.
 *
 * Excludes `*.e2e-spec.ts` — those boot a real Nest app against the local
 * Docker stack (Postgres/Redis/R2) and run separately via `test:e2e`
 * (vitest.config.e2e.ts), so `bun run test` stays fast and infra-free.
 */
export default defineConfig({
	// unplugin-swc replaces Vite's default TS transform; Vite 7's Oxc-based
	// transform must be explicitly disabled too (its own `esbuild: false`
	// only covered the older esbuild path).
	oxc: false,
	test: {
		environment: "node",
		globals: false,
		include: ["src/**/*.spec.ts"],
		exclude: ["**/node_modules/**", "**/*.e2e-spec.ts"],
		coverage: {
			provider: "v8",
			reportsDirectory: "../coverage",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.spec.ts", "src/**/*.dto.ts", "src/main.ts"],
		},
	},
	plugins: [
		swc.vite({
			module: { type: "es6" },
		}),
	],
});
