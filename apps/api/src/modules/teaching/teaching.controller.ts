import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { TeachingService } from "./teaching.service";

/**
 * An instructor's read-only view of the cohorts they're assigned to teach
 * (§Role Definitions). `@Roles("instructor")` lets admins through too; the
 * service verifies the specific cohort assignment for non-admins.
 */
@ApiTags("teaching")
@ApiCookieAuth("better-auth.session_token")
@Controller("instructor/cohorts")
@UseGuards(SessionGuard, RolesGuard)
@Roles("instructor")
export class TeachingController {
	constructor(private readonly teaching: TeachingService) {}

	@Get()
	@ApiOperation({
		summary: "Cohorts the current instructor is assigned to teach",
	})
	myCohorts(@CurrentUser() user: AuthenticatedUser) {
		return this.teaching.myCohorts(user);
	}

	@Get(":cohortId")
	@ApiOperation({
		summary:
			"Read-only overview of a taught cohort (content + roster + progress)",
	})
	detail(
		@CurrentUser() user: AuthenticatedUser,
		@Param("cohortId") cohortId: string,
	) {
		return this.teaching.cohortDetail(user, cohortId);
	}
}
