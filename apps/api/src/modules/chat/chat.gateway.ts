import { Logger } from "@nestjs/common";
import {
	ConnectedSocket,
	MessageBody,
	type OnGatewayConnection,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from "@nestjs/websockets";
import { fromNodeHeaders } from "better-auth/node";
import type { Server, Socket } from "socket.io";
import { auth } from "../../auth/auth.config";
import type { AuthenticatedUser } from "../../auth/types";
import { ChatService } from "./chat.service";

const MAX_MESSAGE_LENGTH = 2000;

function corsOrigins(): string[] {
	return (process.env.FRONTEND_URL ?? "http://localhost:5173")
		.split(",")
		.map((origin) => origin.trim());
}

/**
 * Real-time group chat (§5 Socket.io). Shares the HTTP server/port. Every
 * socket is authenticated from its Better Auth session cookie on connect (same
 * `auth` instance as the REST guards), and every join/message is re-authorised
 * through `ChatService` — the socket is never trusted to name its own identity
 * or its group access. Messages are persisted, then broadcast to the group room.
 */
@WebSocketGateway({
	cors: { origin: corsOrigins(), credentials: true },
})
export class ChatGateway implements OnGatewayConnection {
	@WebSocketServer() server!: Server;
	private readonly logger = new Logger(ChatGateway.name);

	constructor(private readonly chat: ChatService) {}

	private room(groupId: string): string {
		return `group:${groupId}`;
	}

	private actor(client: Socket): AuthenticatedUser | null {
		return (client.data as { user?: AuthenticatedUser }).user ?? null;
	}

	async handleConnection(client: Socket): Promise<void> {
		try {
			const data = await auth.api.getSession({
				headers: fromNodeHeaders(client.handshake.headers),
			});
			if (!data?.session) {
				client.disconnect();
				return;
			}
			(client.data as { user?: AuthenticatedUser }).user =
				data.user as unknown as AuthenticatedUser;
		} catch (error) {
			this.logger.warn(
				`socket auth failed: ${error instanceof Error ? error.message : error}`,
			);
			client.disconnect();
		}
	}

	@SubscribeMessage("group:join")
	async onJoin(
		@ConnectedSocket() client: Socket,
		@MessageBody() body: { groupId: string },
	) {
		const user = this.actor(client);
		if (!user || !body?.groupId) return { ok: false as const };
		try {
			await this.chat.assertAccess(user, body.groupId);
			await client.join(this.room(body.groupId));
			return { ok: true as const };
		} catch {
			return { ok: false as const, error: "forbidden" };
		}
	}

	@SubscribeMessage("group:leave")
	async onLeave(
		@ConnectedSocket() client: Socket,
		@MessageBody() body: { groupId: string },
	) {
		if (body?.groupId) await client.leave(this.room(body.groupId));
		return { ok: true as const };
	}

	@SubscribeMessage("group:message")
	async onMessage(
		@ConnectedSocket() client: Socket,
		@MessageBody() body: { groupId: string; content: string },
	) {
		const user = this.actor(client);
		if (!user || !body?.groupId) return { ok: false as const };
		const content = (body.content ?? "").trim();
		if (!content || content.length > MAX_MESSAGE_LENGTH) {
			return { ok: false as const, error: "invalid" };
		}
		try {
			await this.chat.assertAccess(user, body.groupId);
		} catch {
			return { ok: false as const, error: "forbidden" };
		}
		const message = await this.chat.saveMessage(user.id, body.groupId, content);
		this.server.to(this.room(body.groupId)).emit("group:message", message);
		return { ok: true as const, message };
	}
}
