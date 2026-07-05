import {
	Inject,
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { type ConnectionOptions, type Job, Worker } from "bullmq";
import { PrismaService } from "../../../prisma/prisma.service";
import {
	MEDIA_ENCODER_PORT,
	type MediaEncoderPort,
} from "../../../shared/encoding/media-encoder.port";
import {
	type AudioEncodedEvent,
	type CaptionReadyEvent,
	ContentEvents,
	type VideoEncodedEvent,
} from "../../../shared/events/content-events";
import {
	type AudioJobData,
	type CaptionJobData,
	QUEUE_AUDIO,
	QUEUE_CAPTION,
	QUEUE_CONNECTION,
	QUEUE_VIDEO,
	type VideoJobData,
} from "../../../shared/queue/queue.constants";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../../shared/storage/storage.port";
import { thumbnailSeekSeconds } from "../media.calculator";
import { MediaService } from "../media.service";

/**
 * BullMQ workers for the media pipeline (§12.2–12.4). Each downloads the staged
 * source from R2, runs the FFmpeg/Sharp encode, uploads the derived assets,
 * persists keys on the lesson, then emits a domain event for other contexts.
 */
@Injectable()
export class MediaWorkers implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(MediaWorkers.name);
	private workers: Worker[] = [];

	constructor(
		@Inject(QUEUE_CONNECTION) private readonly connection: ConnectionOptions,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
		@Inject(MEDIA_ENCODER_PORT) private readonly encoder: MediaEncoderPort,
		private readonly prisma: PrismaService,
		private readonly events: EventEmitter2,
		private readonly media: MediaService,
	) {}

	onModuleInit(): void {
		this.workers = [
			new Worker<VideoJobData>(
				QUEUE_VIDEO,
				(job: Job<VideoJobData>) => this.processVideo(job),
				{ connection: this.connection, concurrency: 1 },
			),
			new Worker<AudioJobData>(
				QUEUE_AUDIO,
				(job: Job<AudioJobData>) => this.processAudio(job),
				{ connection: this.connection, concurrency: 1 },
			),
			new Worker<CaptionJobData>(
				QUEUE_CAPTION,
				(job: Job<CaptionJobData>) => this.processCaption(job),
				{ connection: this.connection },
			),
		];
		for (const worker of this.workers) {
			worker.on("failed", (job, err) =>
				this.logger.error(
					`Job ${job?.id} on "${worker.name}" failed: ${err.message}`,
				),
			);
		}
	}

	async onModuleDestroy(): Promise<void> {
		await Promise.all(this.workers.map((worker) => worker.close()));
	}

	private async processVideo(job: Job<VideoJobData>): Promise<void> {
		const data = job.data;
		await job.updateProgress(5);
		const source = await this.storage.getObject(data.sourceKey);
		await job.updateProgress(10);
		const renditions = await this.encoder.encodeVideoRenditions(
			source,
			data.sourceExt,
		);
		await job.updateProgress(70);
		const videoKeys: Record<string, string> = {};
		for (const [index, rendition] of renditions.entries()) {
			const key = `videos/${data.lessonId}/${rendition.quality}.mp4`;
			await this.storage.putObject(key, rendition.data, "video/mp4");
			videoKeys[rendition.quality] = key;
			await job.updateProgress(
				70 + Math.round(((index + 1) / renditions.length) * 18),
			);
		}

		await job.updateProgress(90);
		const thumbnail = await this.encoder.extractThumbnailWebp(
			source,
			data.sourceExt,
			thumbnailSeekSeconds(data.durationSec),
		);
		const thumbnailKey = `videos/${data.lessonId}/thumbnail.webp`;
		await this.storage.putObject(thumbnailKey, thumbnail, "image/webp");
		await job.updateProgress(95);

		const lesson = await this.prisma.lesson.update({
			where: { id: data.lessonId },
			data: { videoKeysJson: videoKeys, videoThumbnailKey: thumbnailKey },
			select: { videoDurationSec: true },
		});
		await this.safeDelete(data.sourceKey);
		await job.updateProgress(100);

		this.events.emit(ContentEvents.VideoEncoded, {
			lessonId: data.lessonId,
			videoKeys,
			thumbnailKey,
			durationSec: lesson.videoDurationSec ?? 0,
		} satisfies VideoEncodedEvent);
	}

	private async processAudio(job: Job<AudioJobData>): Promise<void> {
		const data = job.data;
		await job.updateProgress(10);
		const source = await this.storage.getObject(data.sourceKey);
		await job.updateProgress(25);
		const encoded = await this.encoder.encodeAudioAac(source, data.sourceExt);
		await job.updateProgress(75);
		const audioKey = `audio/${data.lessonId}/primary.m4a`;
		await this.storage.putObject(audioKey, encoded, "audio/mp4");
		await job.updateProgress(90);

		const lesson = await this.prisma.lesson.update({
			where: { id: data.lessonId },
			data: { audioKey, audioSizeBytes: BigInt(encoded.length) },
			select: { audioDurationSec: true },
		});
		await this.safeDelete(data.sourceKey);
		await job.updateProgress(100);

		this.events.emit(ContentEvents.AudioEncoded, {
			lessonId: data.lessonId,
			audioKey,
			durationSec: lesson.audioDurationSec ?? 0,
			sizeBytes: encoded.length,
		} satisfies AudioEncodedEvent);
	}

	private async processCaption(job: Job<CaptionJobData>): Promise<void> {
		const data = job.data;
		await job.updateProgress(20);
		const source = await this.storage.getObject(data.sourceKey);
		await job.updateProgress(45);
		const vtt = await this.encoder.convertSrtToVtt(source);
		await job.updateProgress(70);
		const vttKey = `captions/${data.lessonId}/${data.languageCode}.vtt`;
		await this.storage.putObject(vttKey, vtt, "text/vtt");
		await job.updateProgress(85);
		await this.media.storeCaption(
			data.lessonId,
			data.languageCode,
			vttKey,
			data.uploadedBy,
		);
		await this.safeDelete(data.sourceKey);
		await job.updateProgress(100);

		this.events.emit(ContentEvents.CaptionReady, {
			lessonId: data.lessonId,
			languageCode: data.languageCode,
			vttKey,
		} satisfies CaptionReadyEvent);
	}

	private async safeDelete(key: string): Promise<void> {
		try {
			await this.storage.deleteObject(key);
		} catch {
			this.logger.warn(`Source cleanup failed for ${key}`);
		}
	}
}
