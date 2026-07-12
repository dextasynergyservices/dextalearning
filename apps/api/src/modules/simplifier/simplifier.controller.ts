import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { AiQuotaGuard } from "../../common/guards/ai-quota.guard";
import { UserThrottlerGuard } from "../../common/guards/user-throttler.guard";
import { SimplifierService } from "./simplifier.service";

/**
 * Content Simplifier endpoint (§4.10). Session-gated like media playback; the
 * lesson's own text is the only input (chosen in the service).
 */
@ApiTags("simplifier")
@Controller("lessons")
export class SimplifierController {
	constructor(private readonly simplifier: SimplifierService) {}

	@Post(":lessonId/simplify")
	@UseGuards(SessionGuard, UserThrottlerGuard, AiQuotaGuard)
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	@ApiOperation({ summary: "Rewrite this lesson's text in plainer language" })
	simplify(
		@CurrentUser() user: AuthenticatedUser,
		@Param("lessonId") lessonId: string,
	) {
		return this.simplifier.simplify(user, lessonId);
	}
}
