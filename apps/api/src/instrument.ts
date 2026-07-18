import * as Sentry from "@sentry/nestjs";

/**
 * Sentry bootstrap (§15). MUST be the first import in main.ts — the SDK
 * patches http/express/prisma at require-time, so anything loaded before it
 * escapes tracing entirely.
 *
 * DSN-gated: without SENTRY_DSN this is a no-op, so local dev and the test
 * suites never talk to Sentry — no mocking, no network, no noise. The API has
 * its OWN Sentry project (separate from the web app's): server stack traces,
 * releases and alert rules have nothing in common with browser ones, and a
 * shared project would garble both. Distributed tracing still joins the two
 * via the `sentry-trace` header the web SDK sends.
 */
const dsn = process.env.SENTRY_DSN;
if (dsn) {
	Sentry.init({
		dsn,
		environment:
			process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
		// Keep performance sampling modest: this is a monolith serving media
		// tokens on every lesson view — 10% is plenty to see p95s without
		// burning the free-tier transaction quota.
		tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
		// The error envelope already carries a requestId; send it so a user's
		// screenshot of { requestId } can be matched to the exact event.
		sendDefaultPii: false,
	});
}

export { Sentry };
