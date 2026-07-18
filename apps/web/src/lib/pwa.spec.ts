// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPWA } from "./pwa";

/** Minimal ServiceWorkerContainer stand-in the registration flow drives. */
function fakeContainer(overrides: { waiting?: { postMessage: unknown } } = {}) {
	const registration = {
		waiting: overrides.waiting ?? null,
		installing: null,
		active: { postMessage: vi.fn() },
		addEventListener: vi.fn(),
	};
	const container = {
		register: vi.fn().mockResolvedValue(registration),
		controller: {},
		addEventListener: vi.fn(),
	};
	Object.defineProperty(navigator, "serviceWorker", {
		configurable: true,
		value: container,
	});
	return { container, registration };
}

const fireLoad = () => window.dispatchEvent(new Event("load"));

describe("registerPWA (§6.1 D4)", () => {
	beforeEach(() => vi.unstubAllEnvs());

	/**
	 * The dev guarantee: a caching worker under Vite HMR serves yesterday's
	 * modules — and Playwright drives the dev stack, so this gate is also what
	 * keeps the e2e suite deterministic.
	 */
	it("does nothing outside production", () => {
		vi.stubEnv("PROD", false);
		const { container } = fakeContainer();
		registerPWA(vi.fn());
		fireLoad();
		expect(container.register).not.toHaveBeenCalled();
	});

	it("registers /sw.js in production", async () => {
		vi.stubEnv("PROD", true);
		const { container } = fakeContainer();
		registerPWA(vi.fn());
		fireLoad();
		await vi.waitFor(() =>
			expect(container.register).toHaveBeenCalledWith("/sw.js"),
		);
	});

	it("prompts (not force-reloads) when a new worker is already waiting", async () => {
		vi.stubEnv("PROD", true);
		const waiting = { postMessage: vi.fn() };
		fakeContainer({ waiting });
		const onUpdate = vi.fn();
		registerPWA(onUpdate);
		fireLoad();

		await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
		// Nothing happens until the user opts in…
		expect(waiting.postMessage).not.toHaveBeenCalled();
		// …then the accept callback tells the waiting worker to take over.
		onUpdate.mock.calls[0][0]();
		expect(waiting.postMessage).toHaveBeenCalledWith("SKIP_WAITING");
	});

	it("asks the worker to replay queued progress when back online", async () => {
		vi.stubEnv("PROD", true);
		const { container, registration } = fakeContainer();
		registerPWA(vi.fn());
		fireLoad();
		await vi.waitFor(() => expect(container.register).toHaveBeenCalled());

		window.dispatchEvent(new Event("online"));
		expect(registration.active.postMessage).toHaveBeenCalledWith(
			"REPLAY_QUEUE",
		);
	});
});
