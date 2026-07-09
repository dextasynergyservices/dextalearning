import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { MarkBadgesSeenDto } from "./dto/engagement.dto";
import { EngagementService } from "./engagement.service";

/** Streaks, badges + social proof (§3.1/§3.2 behavioral mechanics). */
@ApiTags("engagement")
@Controller("engagement")
export class EngagementController {
	constructor(private readonly engagement: EngagementService) {}

	@Get("me")
	@ApiCookieAuth("better-auth.session_token")
	@UseGuards(SessionGuard)
	@ApiOperation({
		summary: "The learner's streak, week activity, and badge awards",
	})
	me(@CurrentUser() user: AuthenticatedUser) {
		return this.engagement.getMe(user);
	}

	@Post("badges/seen")
	@ApiCookieAuth("better-auth.session_token")
	@UseGuards(SessionGuard)
	@ApiOperation({
		summary: "Mark badge celebrations as seen (so each shows once)",
	})
	badgesSeen(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: MarkBadgesSeenDto,
	) {
		return this.engagement.markBadgesSeen(user, dto.keys);
	}

	@Get("social-proof")
	@ApiOperation({
		summary:
			"Public social-proof counters for a course (completions this week)",
	})
	socialProof(@Query("courseId") courseId: string) {
		return this.engagement.getSocialProof(courseId ?? "");
	}
}
