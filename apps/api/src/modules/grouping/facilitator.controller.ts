import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { GroupingService } from "./grouping.service";

/**
 * The facilitator portal's data (§4.7). Any signed-in user may ask which
 * cohorts they facilitate — the list is empty unless an admin has assigned
 * them — so only `SessionGuard` gates it (no global role required).
 */
@ApiTags("facilitator")
@ApiCookieAuth("better-auth.session_token")
@Controller("facilitator")
@UseGuards(SessionGuard)
export class FacilitatorController {
	constructor(private readonly grouping: GroupingService) {}

	@Get("cohorts")
	@ApiOperation({
		summary: "Cohorts the current user is assigned to facilitate",
	})
	myCohorts(@CurrentUser() user: AuthenticatedUser) {
		return this.grouping.myFacilitatedCohorts(user);
	}
}
