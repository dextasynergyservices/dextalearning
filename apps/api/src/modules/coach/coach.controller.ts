import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { CoachService } from "./coach.service";

/**
 * Learning Coach (§4.10). Learners read their latest digest; the digests
 * themselves are composed by the weekly sweep. The admin run endpoint triggers
 * a sweep on demand (ops / verification).
 */
@ApiTags("coach")
@Controller("coach")
export class CoachController {
	constructor(private readonly coach: CoachService) {}

	@Get("latest")
	@UseGuards(SessionGuard)
	@ApiOperation({ summary: "Your most recent weekly coaching digest" })
	latest(@CurrentUser() user: AuthenticatedUser) {
		return this.coach.latestFor(user.id);
	}

	@Post("run")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("admin")
	@ApiOperation({ summary: "Run the weekly coach sweep now (admin)" })
	run() {
		return this.coach.sweep();
	}
}
