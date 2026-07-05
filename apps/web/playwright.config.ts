import { defineConfig } from "@playwright/test";

/**
 * Phase F: drives a real browser against the real dev stack — no mocks, no
 * `webServer` auto-start. Assumes `bun run dev:e2e` (apps/api, pointed at the
 * disposable TEST_DATABASE_URL) and `bun run dev` (apps/web) are already
 * running, same as every other manual dev workflow in this repo. See
 * apps/web/e2e/global-setup.ts for the test-DB reset step.
 */
export default defineConfig({
	testDir: "./e2e",
	globalSetup: "./e2e/global-setup.ts",
	fullyParallel: false,
	// All specs share one dev API process + one test DB (no per-worker
	// isolation like a real CI grid would have) — same reason apps/api's
	// integration/e2e Vitest configs force fileParallelism: false. Without
	// this, concurrent workers hammering the single dev server produce real
	// flakiness (slow responses tripping session-timing-sensitive code), not
	// just theoretical risk — hit this directly running 4 workers.
	workers: 1,
	retries: 0,
	use: {
		baseURL: "http://localhost:5173",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		// Auto-grants camera permission and synthesizes a fake test-pattern video
		// device — no real webcam, no permission dialog. Only camera-anticheat.spec.ts
		// uses this; harmless for every other spec.
		permissions: ["camera"],
		launchOptions: {
			args: [
				"--use-fake-ui-for-media-stream",
				"--use-fake-device-for-media-stream",
			],
		},
	},
});
