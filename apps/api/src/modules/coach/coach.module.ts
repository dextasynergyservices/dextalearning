import { Module } from "@nestjs/common";
import { EngagementModule } from "../engagement/engagement.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CoachController } from "./coach.controller";
import { CoachScheduler } from "./coach.scheduler";
import { CoachService } from "./coach.service";

/**
 * Learning Coach bounded context (§6.4): owns coach_digests. Inbound: the
 * weekly scheduler + Engagement's exported query service. Outbound: the
 * Notifications context + the AI port. Learners read their latest digest here.
 */
@Module({
	imports: [EngagementModule, NotificationsModule],
	controllers: [CoachController],
	exports: [CoachService],
	providers: [CoachService, CoachScheduler],
})
export class CoachModule {}
