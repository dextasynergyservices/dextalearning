import * as Sentry from "@sentry/react";

/**
 * Deliberately a separate module: it is the DYNAMIC-IMPORT split point that
 * keeps Sentry's session-replay recorder (~55KB gz) out of the entry chunk
 * (§13.2). Loaded at idle by observability.ts; sampling stays as configured
 * in `Sentry.init` (on-error only).
 */
export function loadReplay(): void {
	const client = Sentry.getClient();
	if (!client) return; // Sentry not configured — nothing to attach to.
	client.addIntegration(
		Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
	);
}
