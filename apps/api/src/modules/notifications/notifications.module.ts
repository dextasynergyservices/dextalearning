import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

/**
 * Notifications bounded context (§6.4): owns the `notifications` table and
 * all outbound delivery. Other contexts call `NotificationsService.notify()`
 * — the exported thin interface — and never touch channels directly.
 */
@Module({
	controllers: [NotificationsController],
	providers: [NotificationsService],
	exports: [NotificationsService],
})
export class NotificationsModule {}
