import { Module } from "@nestjs/common";
import { EngagementModule } from "../engagement/engagement.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { RemindersEventsHandler } from "./reminders.events-handler";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";

/**
 * Reminders bounded context (§6.4): owns review_items + reminder_logs.
 * Inbound: LessonCompleted subscription + Engagement's exported query
 * service. Outbound: the Notifications context. No controller — this
 * context talks to users through notifications, not HTTP.
 */
@Module({
	imports: [EngagementModule, NotificationsModule],
	providers: [RemindersService, RemindersEventsHandler, RemindersScheduler],
})
export class RemindersModule {}
