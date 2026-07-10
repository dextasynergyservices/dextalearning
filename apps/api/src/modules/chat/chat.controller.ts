import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { ChatService } from "./chat.service";
import { HistoryQueryDto } from "./dto/history-query.dto";

/** Group chat REST surface (§4.7 community) — history + discovery; live
 *  messaging rides the WebSocket gateway. */
@ApiTags("chat")
@ApiCookieAuth("better-auth.session_token")
@Controller("groups")
@UseGuards(SessionGuard)
export class ChatController {
	constructor(private readonly chat: ChatService) {}

	@Get("mine")
	@ApiOperation({ summary: "Every group the current user belongs to" })
	mine(@CurrentUser() user: AuthenticatedUser) {
		return this.chat.myGroups(user.id);
	}

	@Get("in-cohort/:cohortId")
	@ApiOperation({
		summary: "The current user's group within a cohort (or null)",
	})
	inCohort(
		@CurrentUser() user: AuthenticatedUser,
		@Param("cohortId") cohortId: string,
	) {
		return this.chat.myGroupInCohort(user.id, cohortId);
	}

	@Get(":groupId")
	@ApiOperation({ summary: "Group header + roster for the chat screen" })
	group(
		@CurrentUser() user: AuthenticatedUser,
		@Param("groupId") groupId: string,
	) {
		return this.chat.groupInfo(user, groupId);
	}

	@Get(":groupId/messages")
	@ApiOperation({ summary: "Paginated message history (newest page first)" })
	messages(
		@CurrentUser() user: AuthenticatedUser,
		@Param("groupId") groupId: string,
		@Query() query: HistoryQueryDto,
	) {
		return this.chat.history(user, groupId, query.limit ?? 30, query.cursor);
	}
}
