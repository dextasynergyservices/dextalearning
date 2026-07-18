import * as Sentry from "@sentry/react";
import posthog from "posthog-js";

/**
 * Web observability (§15): Sentry (errors) + PostHog (product analytics +
 * session replay). Both are env-gated no-ops — a checkout without
 * VITE_SENTRY_DSN / VITE_POSTHOG_KEY runs completely offline, so local dev,
 * jsdom specs and Playwright never send telemetry or need mocks.
 *
 * The web app has its OWN Sentry project (browser stack traces, releases and
 * source maps are a different world from the API's); PostHog is the SAME
 * project as the API's server events — one product, one event stream, joined
 * by distinct_id = our user id.
 */

/** True on any assessment-taking route — see `syncReplayPrivacy`. */
const isProctoredRoute = (pathname: string): boolean =>
	pathname.startsWith("/learn/assessment/");

/**
 * A value copied straight from .env.local.example ("phc_...",
 * "https://...@sentry.io/...", "your-…") is scaffolding, not configuration —
 * initialising with it would phone home with garbage credentials and spam the
 * console on every dev machine. Only a real-looking value counts.
 */
function configured(value: string | undefined): value is string {
	return (
		Boolean(value) && !value?.includes("...") && !value?.startsWith("your-")
	);
}

export function initObservability(): void {
	const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
	if (configured(dsn)) {
		Sentry.init({
			dsn,
			environment: import.meta.env.MODE,
			// Modest sampling: enough to see p75 page loads without burning quota.
			tracesSampleRate: 0.1,
			// Replay-on-error only: full-session replay of a learning platform is
			// quota-hungry and privacy-sensitive; ten seconds before a crash is
			// the part that debugs it.
			replaysSessionSampleRate: 0,
			replaysOnErrorSampleRate: 0.5,
		});
		// Replay is ~55KB gz — far too heavy for the entry chunk (§13.2). Error
		// capture starts immediately above; the replay recorder joins at idle
		// via its own chunk (`sentry-replay.ts` is the split point) and buffers
		// from then on. A crash in the first idle moment loses only the replay,
		// never the error itself.
		const attachReplay = () =>
			import("./sentry-replay").then(({ loadReplay }) => loadReplay());
		if ("requestIdleCallback" in window) {
			requestIdleCallback(() => void attachReplay(), { timeout: 5000 });
		} else {
			setTimeout(() => void attachReplay(), 3000);
		}
	}

	const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
	if (configured(key)) {
		posthog.init(key, {
			api_host:
				(import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
				"https://eu.i.posthog.com",
			// The router owns navigation; we capture pageviews there (SPA — the
			// automatic one only fires on full loads).
			capture_pageview: false,
			persistence: "localStorage+cookie",
			// Replay privacy floor: never record what someone types, anywhere.
			session_recording: { maskAllInputs: true },
			// An exam is not a product-research artefact: no session recording in
			// proctored assessments — being watched by anti-cheat is disclosed,
			// being watched by product analytics is not (§4.6.2, §15).
			loaded: (ph) => {
				if (isProctoredRoute(window.location.pathname)) {
					ph.stopSessionRecording();
				}
			},
		});
	}
}

/** SPA pageview + per-route replay privacy; call on every router navigation. */
export function trackPageView(pathname: string): void {
	if (!posthog.__loaded) return;
	if (isProctoredRoute(pathname)) {
		posthog.stopSessionRecording();
	} else {
		posthog.startSessionRecording();
	}
	posthog.capture("$pageview", { $current_url: window.location.href });
}

/**
 * Tie both tools to the signed-in user. PostHog's distinct_id becomes the same
 * user id the API's server events use — this is the join that makes funnels
 * span client and server. Sentry gets id only (no email: error reports should
 * identify a row, not leak PII into a third-party tool).
 */
export function identifyUser(user: { id: string; role?: string } | null): void {
	if (user) {
		if (posthog.__loaded) {
			posthog.identify(user.id, { role: user.role });
		}
		Sentry.setUser({ id: user.id });
	} else {
		if (posthog.__loaded) posthog.reset();
		Sentry.setUser(null);
	}
}
