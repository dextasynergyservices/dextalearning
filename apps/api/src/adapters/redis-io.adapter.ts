import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { Server, ServerOptions } from "socket.io";
import { isDistributedRuntime } from "../common/runtime";

/**
 * Socket.io adapter that fans chat events out across API instances through Redis
 * pub/sub (§5). This is a MULTI-INSTANCE concern only — a single instance
 * delivers to its own connected sockets with Socket.io's default in-memory
 * adapter, so it is gated on `REDIS_DISTRIBUTED` (not merely `REDIS_URL`): the
 * pub/sub subscription holds an open connection and every message costs Redis
 * commands, neither of which the free single-instance tier should pay (see
 * runtime.ts). Connection errors are swallowed — Redis must not take chat down.
 */
export class RedisIoAdapter extends IoAdapter {
	private adapterConstructor?: ReturnType<typeof createAdapter>;

	async connectToRedis(): Promise<void> {
		if (!isDistributedRuntime()) return;
		const url = process.env.REDIS_URL as string;
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
