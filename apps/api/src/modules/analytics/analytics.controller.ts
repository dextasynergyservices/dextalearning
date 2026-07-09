import {
	Controller,
	Get,
	NotFoundException,
	Param,
	UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { AnalyticsService, isAnalyticsEntityType } from "./analytics.service";

/** Course/platform analytics (§2.4 role matrix, §15). Read-only. */
@ApiTags("analytics")
@ApiCookieAuth("better-auth.session_token")
@Controller("analytics")
@UseGuards(SessionGuard, RolesGuard)
export class AnalyticsController {
	constructor(private readonly analytics: AnalyticsService) {}

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
