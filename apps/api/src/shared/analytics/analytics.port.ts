/**
 * Product-analytics port (§15, §6.4 ports/adapters). The domain never knows
 * PostHog exists: contexts emit their usual events, the product-analytics
 * handler forwards them through this port, and the adapter is chosen at boot
 * (PostHog when POSTHOG_KEY is set, a no-op otherwise — so dev machines and
 * the entire test suite never open a network connection to analytics).
 *
 * `capture` is fire-and-forget BY CONTRACT: an analytics outage must never
 * slow or fail a domain operation, so implementations queue internally and
 * swallow their own errors.
 */
export const ANALYTICS_PORT = Symbol("ANALYTICS_PORT");

export interface AnalyticsCapture {
	/** The user the event belongs to — PostHog's distinct_id. */
	distinctId: string;
	/** snake_case event name, past tense: `order_settled`, `lesson_completed`. */
	event: string;
	properties?: Record<string, unknown>;
}

export interface AnalyticsPort {
	capture(input: AnalyticsCapture): void;
	/** Flush pending events on shutdown so the last batch isn't lost. */
	shutdown(): Promise<void>;
}
