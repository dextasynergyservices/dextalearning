import { Module } from "@nestjs/common";
import { ProductAnalyticsEventsHandler } from "./product-analytics.events-handler";

/**
 * Product analytics (§15) — event subscribers only. Owns no tables, exposes no
 * endpoints, imports no other context; deleting this module changes nothing
 * except that PostHog stops hearing about the platform.
 */
@Module({
	providers: [ProductAnalyticsEventsHandler],
})
export class ProductAnalyticsModule {}
