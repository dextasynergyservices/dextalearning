import { Global, Module, type Provider } from "@nestjs/common";
import { type ConnectionOptions, Queue } from "bullmq";
import {
	AUDIO_QUEUE,
	CAPTION_QUEUE,
	EARN_BACK_QUEUE,
	INSTRUCTOR_PAYOUT_QUEUE,
	QUEUE_AUDIO,
	QUEUE_CAPTION,
	QUEUE_CONNECTION,
	QUEUE_EARN_BACK,
	QUEUE_INSTRUCTOR_PAYOUT,
	QUEUE_VIDEO,
	VIDEO_QUEUE,
} from "./queue.constants";

// Hand BullMQ a connection *options* object (it owns the client) rather than a
// shared ioredis instance — avoids version-skew between app ioredis and the one
// BullMQ bundles. `maxRetriesPerRequest: null` is required by blocking workers.
//
// BullMQ's blocking workers are a poor fit for per-command-billed serverless
// Redis (e.g. Upstash free). `QUEUE_REDIS_URL` lets the queue point at a small
// PERSISTENT Redis while sessions/cache stay on serverless — a deploy-time env
// flip, no code change. Falls back to the shared `REDIS_URL` when unset.
function buildConnection(): ConnectionOptions {
	const url = new URL(
		process.env.QUEUE_REDIS_URL ??
			process.env.REDIS_URL ??
			"redis://localhost:6379",
	);
	return {
		host: url.hostname,
		port: Number(url.port || 6379),
		username: url.username || undefined,
		password: url.password || undefined,
		tls: url.protocol === "rediss:" ? {} : undefined,
		maxRetriesPerRequest: null,
	};
}

function queueProvider(token: symbol, name: string): Provider {
	return {
		provide: token,
		useFactory: (connection: ConnectionOptions) =>
			new Queue(name, { connection }),
		inject: [QUEUE_CONNECTION],
	};
}

/**
 * Shared BullMQ connection options + the media queues, exposed as DI tokens.
 * Producers inject a `Queue`; workers (Media context) build a `Worker` from the
 * shared connection. Global so any context can enqueue durable work (§6.4).
 */
@Global()
@Module({
	providers: [
		{ provide: QUEUE_CONNECTION, useFactory: buildConnection },
		queueProvider(VIDEO_QUEUE, QUEUE_VIDEO),
		queueProvider(AUDIO_QUEUE, QUEUE_AUDIO),
		queueProvider(CAPTION_QUEUE, QUEUE_CAPTION),
		queueProvider(INSTRUCTOR_PAYOUT_QUEUE, QUEUE_INSTRUCTOR_PAYOUT),
		queueProvider(EARN_BACK_QUEUE, QUEUE_EARN_BACK),
	],
	exports: [
		QUEUE_CONNECTION,
		VIDEO_QUEUE,
		AUDIO_QUEUE,
		CAPTION_QUEUE,
		INSTRUCTOR_PAYOUT_QUEUE,
		EARN_BACK_QUEUE,
	],
})
export class QueueModule {}
