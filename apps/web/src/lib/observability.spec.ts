// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sentryInit, posthogInit } = vi.hoisted(() => ({
	sentryInit: vi.fn(),
	posthogInit: vi.fn(),
}));

vi.mock("@sentry/react", () => ({
	init: sentryInit,
	setUser: vi.fn(),
	replayIntegration: vi.fn(() => ({})),
}));

vi.mock("posthog-js", () => ({
	default: {
		init: posthogInit,
		// __loaded stays false — the unconfigured state.
		__loaded: false,
		capture: vi.fn(),
		identify: vi.fn(),
		reset: vi.fn(),
		startSessionRecording: vi.fn(),
		stopSessionRecording: vi.fn(),
	},
}));

/**
 * The offline guarantee (§15): with no DSN/key configured — which is every
 * dev machine, every jsdom spec and every Playwright run — observability must
 * be a complete no-op: no Sentry.init, no posthog.init, no network.
 */
describe("observability init (§15)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("initialises nothing when the env keys are absent", async () => {
		vi.stubEnv("VITE_SENTRY_DSN", "");
		vi.stubEnv("VITE_POSTHOG_KEY", "");
		const { initObservability, trackPageView, identifyUser } = await import(
			"./observability"
		);
		initObservability();

		expect(sentryInit).not.toHaveBeenCalled();
		expect(posthogInit).not.toHaveBeenCalled();

		// The runtime hooks must also be safe to call in this state — the router
		// and session effects fire regardless of configuration.
		expect(() => trackPageView("/learn/course/x")).not.toThrow();
		expect(() => identifyUser({ id: "u1", role: "learner" })).not.toThrow();
		expect(() => identifyUser(null)).not.toThrow();
	});

	/**
	 * Regression for a real catch: dev machines that copied .env.local.example
	 * carry placeholder values ("phc_...", "https://...@sentry.io/..."), and a
	 * bare truthiness check initialised telemetry with garbage credentials on
	 * every one of them.
	 */
	it("treats scaffold placeholder values as unconfigured", async () => {
		vi.stubEnv("VITE_SENTRY_DSN", "https://...@sentry.io/...");
		vi.stubEnv("VITE_POSTHOG_KEY", "phc_...");
		const { initObservability } = await import("./observability");
		initObservability();

		expect(sentryInit).not.toHaveBeenCalled();
		expect(posthogInit).not.toHaveBeenCalled();
	});

	it("initialises both when real values are present", async () => {
		vi.stubEnv("VITE_SENTRY_DSN", "https://abc123@o450.ingest.sentry.io/450");
		vi.stubEnv("VITE_POSTHOG_KEY", "phc_realkey123");
		const { initObservability } = await import("./observability");
		initObservability();

		expect(sentryInit).toHaveBeenCalledTimes(1);
		expect(posthogInit).toHaveBeenCalledTimes(1);
		// Replay privacy floor rides along with init, not as an afterthought.
		expect(posthogInit.mock.calls[0][1]).toMatchObject({
			session_recording: { maskAllInputs: true },
			capture_pageview: false,
		});
	});
});
