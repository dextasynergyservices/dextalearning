import { Module } from "@nestjs/common";
import { EngagementModule } from "../engagement/engagement.module";
import { PacingController } from "./pacing.controller";
import { PacingService } from "./pacing.service";

/**
 * Adaptive Pacing bounded context (§6.4) — owns no tables. Reads the learner's
 * weekly goal + Engagement's exported weekly activity and runs a pure
 * calculator, so it could be extracted with only that query changing.
 */
@Module({
	imports: [EngagementModule],
	controllers: [PacingController],
	providers: [PacingService],
})
export class PacingModule {}
