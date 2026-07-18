import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { PostHog } from "posthog-node";
import type { AnalyticsCapture, AnalyticsPort } from "./analytics.port";

/**
 * PostHog adapter (§15). Server-side events use the SAME PostHog project as
 * the web app (one product = one event stream): funnels join client and server
 * events by distinct_id, which is always our user id — the web SDK calls
 * `identify(userId)` so the two halves meet.
 *
 * posthog-node batches internally and never throws from `capture`, which is
 * exactly the port's contract. `shutdown()` flushes the final batch.
 */
@Injectable()
export class PostHogAnalyticsAdapter implements AnalyticsPort, OnModuleDestroy {
	private readonly logger = new Logger(PostHogAnalyticsAdapter.name);
	private readonly client: PostHog;

	constructor() {
		this.client = new PostHog(process.env.POSTHOG_KEY ?? "", {
			host: process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com",
			// Small batches, short interval: this API emits tens of events/min,
			// not thousands — latency to the dashboard beats batching efficiency.
			flushAt: 20,
			flushInterval: 10_000,
		});
		this.client.on("error", (err: Error) => {
			// Analytics must never take the API down with it — log and move on.
			this.logger.warn(`PostHog delivery failed: ${err.message}`);
		});
	}

	capture({ distinctId, event, properties }: AnalyticsCapture): void {
		this.client.capture({ distinctId, event, properties });
	}

	async shutdown(): Promise<void> {
		await this.client.shutdown();
	}

	async onModuleDestroy(): Promise<void> {
		await this.shutdown();
	}
}

/** Bound when POSTHOG_KEY is absent — dev and tests stay offline. */
@Injectable()
export class NoopAnalyticsAdapter implements AnalyticsPort {
	capture(): void {}
	async shutdown(): Promise<void> {}
}
