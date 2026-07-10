import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { Server, ServerOptions } from "socket.io";

/**
 * Socket.io adapter that fans events out across API instances through Redis
 * pub/sub (§5 — "Group chat, notifications" on Redis). When `REDIS_URL` is set
 * it wires the `@socket.io/redis-adapter`; otherwise it falls back to Socket.io's
 * default in-memory adapter, so local dev and tests need no Redis. Connection
 * errors are swallowed — a Redis blip must not take the socket server down.
 */
export class RedisIoAdapter extends IoAdapter {
	private adapterConstructor?: ReturnType<typeof createAdapter>;

	async connectToRedis(): Promise<void> {
		const url = process.env.REDIS_URL;
		if (!url) return;
		const pubClient = new Redis(url, { maxRetriesPerRequest: null });
		const subClient = pubClient.duplicate();
		pubClient.on("error", () => {});
		subClient.on("error", () => {});
		this.adapterConstructor = createAdapter(pubClient, subClient);
	}

	createIOServer(port: number, options?: ServerOptions): Server {
		const server: Server = super.createIOServer(port, options);
		if (this.adapterConstructor) server.adapter(this.adapterConstructor);
		return server;
	}
}
