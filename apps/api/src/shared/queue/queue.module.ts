import { Global, Module } from "@nestjs/common";
import { isQueueDurable } from "../../common/runtime";
import { BullMqQueueAdapter } from "./bullmq-queue.adapter";
import { InlineQueueAdapter } from "./inline-queue.adapter";
import { QUEUE_PORT } from "./queue.port";

/**
 * Background queue (§6.1 / §6.4), exposed as the `QUEUE_PORT` so producers and
 * workers never import BullMQ. The adapter is chosen at boot:
 *  - `BullMqQueueAdapter`  — when a dedicated persistent Redis is configured
 *    (`QUEUE_REDIS_URL`, or a full multi-instance deploy). Durable + retryable.
 *  - `InlineQueueAdapter`  — otherwise (the free tier): in-process, zero Redis,
 *    so the metered cache Redis is never hit by blocking workers.
 *
 * Flipping tiers is a deploy-time env change — no code touches. Global so any
 * bounded context can enqueue durable work without importing this module.
 */
@Global()
@Module({
	providers: [
		{
			provide: QUEUE_PORT,
			useClass: isQueueDurable() ? BullMqQueueAdapter : InlineQueueAdapter,
		},
	],
	exports: [QUEUE_PORT],
})
export class QueueModule {}
