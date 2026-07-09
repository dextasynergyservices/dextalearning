import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { EngagementController } from "./engagement.controller";
import { EngagementEventsHandler } from "./engagement.events-handler";
import { EngagementService } from "./engagement.service";
import { EngagementQueryService } from "./engagement-query.service";

/**
 * Engagement bounded context (§6.4): owns user_streaks, user_badges and
 * progress_events. Inbound: learning-event subscriptions. Outbound: HTTP for
 * the learner, the thin `EngagementQueryService` other contexts may import,
 * and `NotificationsService` for new-badge in-app notifications (§8.6).
 */
@Module({
	imports: [NotificationsModule],
	controllers: [EngagementController],
	providers: [
		EngagementService,
		EngagementEventsHandler,
		EngagementQueryService,
	],
	exports: [EngagementQueryService],
})
export class EngagementModule {}
