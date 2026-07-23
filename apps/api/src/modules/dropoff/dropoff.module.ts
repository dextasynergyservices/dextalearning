import { Module } from "@nestjs/common";
import { EngagementModule } from "../engagement/engagement.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { DropoffController } from "./dropoff.controller";
import { DropoffScheduler } from "./dropoff.scheduler";
import { DropoffService } from "./dropoff.service";
import { DropoffQueryService } from "./dropoff-query.service";

/**
 * Drop-off predictor bounded context (§6.4): owns dropoff_flags. Inbound: the
 * daily scheduler + Engagement's exported signals. Outbound: the Notifications
 * context. Exports the thin `DropoffQueryService` so Teaching + Facilitator can
 * merge at-risk flags into their rosters.
 */
@Module({
	imports: [EngagementModule, NotificationsModule],
	controllers: [DropoffController],
	providers: [DropoffService, DropoffQueryService, DropoffScheduler],
	exports: [DropoffQueryService, DropoffService],
})
export class DropoffModule {}
