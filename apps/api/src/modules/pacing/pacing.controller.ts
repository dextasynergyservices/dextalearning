import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { PacingService } from "./pacing.service";

/**
 * Adaptive Pacing (§4.10). One session-gated read: the learner's current
 * pacing signal, fetched by the lesson player when a lesson completes.
 */
@ApiTags("pacing")
@Controller("pacing")
export class PacingController {
	constructor(private readonly pacing: PacingService) {}

	@Get("me")
	@UseGuards(SessionGuard)
	@ApiOperation({ summary: "Your current adaptive pacing signal" })
	me(@CurrentUser() user: AuthenticatedUser) {
		return this.pacing.signalFor(user);
	}
}
