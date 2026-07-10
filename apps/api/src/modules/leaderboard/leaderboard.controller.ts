import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { LeaderboardQueryDto } from "./dto/leaderboard-query.dto";
import { LeaderboardService } from "./leaderboard.service";

/** Ranked leaderboards (§4.9) — five types, Redis-cached, optionally per-cohort. */
@ApiTags("leaderboard")
@ApiCookieAuth("better-auth.session_token")
@Controller("leaderboard")
@UseGuards(SessionGuard)
export class LeaderboardController {
	constructor(private readonly leaderboard: LeaderboardService) {}

	@Get()
	@ApiOperation({
		summary: "A ranked leaderboard with the caller's own position",
	})
	get(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: LeaderboardQueryDto,
	) {
		return this.leaderboard.getLeaderboard(user, {
			type: query.type ?? "overall",
			cohortId: query.cohortId,
			period: query.period ?? "all_time",
			limit: query.limit ?? 20,
		});
	}
}
