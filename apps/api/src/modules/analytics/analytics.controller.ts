import {
	Controller,
	Get,
	NotFoundException,
	Param,
	Query,
	UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { AnalyticsService, isAnalyticsEntityType } from "./analytics.service";
import { AnalyticsTrendsService } from "./analytics-trends.service";

/** Course/platform analytics (§2.4 role matrix, §15). Read-only. */
@ApiTags("analytics")
@ApiCookieAuth("better-auth.session_token")
@Controller("analytics")
@UseGuards(SessionGuard, RolesGuard)
export class AnalyticsController {
	constructor(
		private readonly analytics: AnalyticsService,
		private readonly trends: AnalyticsTrendsService,
	) {}

	@Get("instructor/enrolment-trend")
	@Roles("instructor", "admin")
	@ApiOperation({
		summary: "Daily enrolments into the caller's content (UTC days)",
	})
	enrolmentTrend(
		@CurrentUser() user: AuthenticatedUser,
		@Query("days") days?: string,
	) {
		return this.trends.enrolmentTrend(user, Number(days) || 90);
	}

	@Get("instructor/earnings-trend")
	@Roles("instructor", "admin")
	@ApiOperation({
		summary: "Monthly earnings: guaranteed cut + forfeited Earn-Back (§8.5.1)",
	})
	earningsTrend(
		@CurrentUser() user: AuthenticatedUser,
		@Query("months") months?: string,
	) {
		return this.trends.earningsTrend(user, Number(months) || 12);
	}

	@Get("instructor/outcome-distribution")
	@Roles("instructor", "admin")
	@ApiOperation({
		summary: "Not started / in progress / completed across caller's content",
	})
	outcomeDistribution(@CurrentUser() user: AuthenticatedUser) {
		return this.trends.outcomeDistribution(user);
	}

	@Get("instructor/earn-back-outcomes")
	@Roles("instructor", "admin")
	@ApiOperation({
		summary: "Resolved Earn-Back sales: on time / late / missed (§4.11.4)",
	})
	earnBackOutcomes(@CurrentUser() user: AuthenticatedUser) {
		return this.trends.earnBackOutcomes(user);
	}

	@Get("activity-heatmap")
	@Roles("instructor", "admin")
	@ApiOperation({
		summary: "Progress events by UTC day-of-week × hour (role-scoped)",
	})
	activityHeatmap(
		@CurrentUser() user: AuthenticatedUser,
		@Query("days") days?: string,
	) {
		return this.trends.activityHeatmap(user, Number(days) || 90);
	}

	@Get("admin/revenue-by-type")
	@Roles("admin")
	@ApiOperation({ summary: "Gross settled revenue by content type" })
	revenueByType() {
		return this.trends.revenueByType();
	}

	@Get("admin/learner-growth")
	@Roles("admin")
	@ApiOperation({ summary: "Cumulative registered learners by month" })
	learnerGrowth(@Query("months") months?: string) {
		return this.trends.learnerGrowth(Number(months) || 12);
	}

	@Get("admin/revenue-trend")
	@Roles("admin")
	@ApiOperation({
		summary: "Monthly platform revenue (§14.1.1 definitions, UTC months)",
	})
	revenueTrend(@Query("months") months?: string) {
		return this.trends.platformRevenueTrend(Number(months) || 12);
	}

	@Get("admin/anti-cheat-summary")
	@Roles("admin")
	@ApiOperation({
		summary: "Anti-cheat health: flagged/unmonitored/escalated + event mix",
	})
	antiCheat(@Query("days") days?: string) {
		return this.trends.antiCheatSummary(Number(days) || 30);
	}

	@Get(":entityType/:id/funnel")
	@Roles("instructor", "admin")
	@ApiOperation({
		summary:
			"Enrolled → started → completed funnel (creator, admin, or assigned cohort instructor)",
	})
	funnel(
		@CurrentUser() user: AuthenticatedUser,
		@Param("entityType") entityType: string,
		@Param("id") id: string,
	) {
		if (!isAnalyticsEntityType(entityType)) {
			throw new NotFoundException("Unknown content type");
		}
		return this.trends.completionFunnel(user, entityType, id);
	}

	@Get("instructor")
	@Roles("instructor", "admin")
	@ApiOperation({
		summary: "Instructor: analytics for own courses (admins: all courses)",
	})
	instructor(@CurrentUser() user: AuthenticatedUser) {
		return this.analytics.instructorOverview(user);
	}

	@Get("admin")
	@Roles("admin")
	@ApiOperation({ summary: "Admin: platform-wide overview + every course" })
	admin() {
		return this.analytics.adminOverview();
	}

	@Get(":entityType/:id/learners")
	@Roles("instructor", "admin")
	@ApiOperation({
		summary:
			"Per-learner drill-down for one course/path/cohort (ownership-scoped)",
	})
	learners(
		@CurrentUser() user: AuthenticatedUser,
		@Param("entityType") entityType: string,
		@Param("id") id: string,
	) {
		if (!isAnalyticsEntityType(entityType)) {
			throw new NotFoundException("Unknown content type");
		}
		return this.analytics.listLearners(user, entityType, id);
	}

	@Get(":entityType/:id/learners/:userId")
	@Roles("instructor", "admin")
	@ApiOperation({
		summary: "One learner's performance inside one course/path/cohort",
	})
	learnerDetail(
		@CurrentUser() user: AuthenticatedUser,
		@Param("entityType") entityType: string,
		@Param("id") id: string,
		@Param("userId") userId: string,
	) {
		if (!isAnalyticsEntityType(entityType)) {
			throw new NotFoundException("Unknown content type");
		}
		return this.analytics.getLearnerDetail(user, entityType, id, userId);
	}
}
