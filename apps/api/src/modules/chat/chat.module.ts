import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";

/**
 * Community chat bounded context (§6.4) — owns `group_messages`. REST serves
 * discovery + history; the gateway serves live messaging. Both route through
 * `ChatService` for authorisation and persistence.
 */
@Module({
	controllers: [ChatController],
	providers: [ChatService, ChatGateway],
})
export class ChatModule {}
