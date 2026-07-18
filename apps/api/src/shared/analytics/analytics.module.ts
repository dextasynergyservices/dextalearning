import { Global, Module } from "@nestjs/common";
import { ANALYTICS_PORT } from "./analytics.port";
import {
	NoopAnalyticsAdapter,
	PostHogAnalyticsAdapter,
} from "./posthog.adapter";

/**
 * Global analytics port binding (§15, §6.4). Adapter chosen once at boot:
 * PostHog only when a key is configured, so local dev and every test run get
 * the no-op — no env juggling, no network, no mocks.
 */
@Global()
@Module({
	providers: [
		{
			provide: ANALYTICS_PORT,
			useClass: process.env.POSTHOG_KEY
				? PostHogAnalyticsAdapter
				: NoopAnalyticsAdapter,
		},
	],
	exports: [ANALYTICS_PORT],
})
export class AnalyticsPortModule {}
