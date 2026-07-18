import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsTrendsService } from "./analytics-trends.service";

/**
 * Reporting read model (blueprint AnalyticsModule): aggregates enrolment,
 * completion and progress-event data into instructor/admin dashboards.
 * Read-only by design — it never writes another context's tables.
 */
@Module({
	controllers: [AnalyticsController],
	providers: [AnalyticsService, AnalyticsTrendsService],
})
export class AnalyticsModule {}
