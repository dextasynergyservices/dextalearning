import {
	Body,
	Controller,
	HttpException,
	Param,
	Post,
	Res,
	UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { AiQuotaGuard } from "../../common/guards/ai-quota.guard";
import { UserThrottlerGuard } from "../../common/guards/user-throttler.guard";
import { AskTutorDto } from "./dto/ask-tutor.dto";
import { TutorService } from "./tutor.service";

/**
 * AI Lesson Tutor endpoint (§4.10). Session-gated like media playback; the
 * transcript is the only knowledge source (enforced in the service). Rate-
 * limited + daily-quota'd (§5) since each call bills the AI provider.
 */
@ApiTags("tutor")
@Controller("lessons")
export class TutorController {
	constructor(private readonly tutor: TutorService) {}

	@Post(":lessonId/tutor")
	@UseGuards(SessionGuard, UserThrottlerGuard, AiQuotaGuard)
	@Throttle({ default: { limit: 20, ttl: 60_000 } })
	@ApiOperation({ summary: "Ask the AI tutor about this lesson" })
	ask(
		@CurrentUser() user: AuthenticatedUser,
		@Param("lessonId") lessonId: string,
		@Body() dto: AskTutorDto,
	) {
		return this.tutor.ask(user, lessonId, dto);
	}

	@Post(":lessonId/tutor/stream")
	@UseGuards(SessionGuard, UserThrottlerGuard, AiQuotaGuard)
	@Throttle({ default: { limit: 20, ttl: 60_000 } })
	@ApiOperation({ summary: "Ask the AI tutor with a streamed answer" })
	async askStream(
		@CurrentUser() user: AuthenticatedUser,
		@Param("lessonId") lessonId: string,
		@Body() dto: AskTutorDto,
		@Res() res: Response,
	): Promise<void> {
		let started = false;
		try {
			for await (const delta of this.tutor.askStream(user, lessonId, dto)) {
				if (!started) {
					// Headers set lazily so a pre-stream error still gets a JSON status.
					res.status(200);
					res.setHeader("Content-Type", "text/plain; charset=utf-8");
					res.setHeader("Cache-Control", "no-cache, no-transform");
					res.setHeader("X-Accel-Buffering", "no");
					started = true;
				}
				res.write(delta);
			}
		} catch (error) {
			if (!started && !res.headersSent) {
				const status = error instanceof HttpException ? error.getStatus() : 502;
				const body =
					error instanceof HttpException ? error.getResponse() : "AI error";
				res.status(status).json({ success: false, error: body });
				return;
			}
			// Mid-stream failure — end the partial answer cleanly.
		}
		res.end();
	}
}
