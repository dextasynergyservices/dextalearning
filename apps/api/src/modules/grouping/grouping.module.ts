import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { FacilitatorController } from "./facilitator.controller";
import { GroupingController } from "./grouping.controller";
import { GroupingService } from "./grouping.service";

/**
 * Grouping bounded context (§4.7, §6.4) — owns groups + group_members, plans
 * membership with a pure calculator, and notifies via the Notifications
 * context on re-group.
 */
@Module({
	imports: [NotificationsModule],
	controllers: [GroupingController, FacilitatorController],
	providers: [GroupingService],
})
export class GroupingModule {}
