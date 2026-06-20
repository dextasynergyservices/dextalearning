import { Module } from "@nestjs/common";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { MediaWorkers } from "./workers/media.workers";

/**
 * Media bounded context: instructor uploads + protected delivery (controller),
 * orchestration (service), and the BullMQ encode workers. Depends only on the
 * global storage/encoder/queue ports + Prisma — no other context internals.
 */
@Module({
	controllers: [MediaController],
	providers: [MediaService, MediaWorkers],
	exports: [MediaService],
})
export class MediaModule {}
