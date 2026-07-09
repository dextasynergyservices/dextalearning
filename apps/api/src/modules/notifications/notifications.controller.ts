import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { NotificationsService } from "./notifications.service";

/** In-app notification feed (§8.6 "In-App" channel) — the header bell. */
@ApiTags("notifications")
@ApiCookieAuth("better-auth.session_token")
@Controller("notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
	constructor(private readonly notifications: NotificationsService) {}

	@Get()
	@ApiOperation({ summary: "The user's notifications, newest first" })
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Query("limit") limit?: string,
		@Query("cursor") cursor?: string,
	) {
		return this.notifications.list(user, Number(limit) || 20, cursor);
	}

	@Post(":id/read")
	@ApiOperation({ summary: "Mark one notification read" })
	markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.notifications.markRead(user, id);
	}

	@Post("read-all")
	@ApiOperation({ summary: "Mark all notifications read" })
	markAllRead(@CurrentUser() user: AuthenticatedUser) {
		return this.notifications.markAllRead(user);
	}
}
