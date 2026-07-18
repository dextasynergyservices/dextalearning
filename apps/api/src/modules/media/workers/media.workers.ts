import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
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
	QUEUE_VIDEO,
	type VideoJobData,
} from "../../../shared/queue/queue.constants";
import {
	type JobContext,
	QUEUE_PORT,
	type QueuePort,
} from "../../../shared/queue/queue.port";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../../shared/storage/storage.port";
import { thumbnailSeekSeconds } from "../media.calculator";
import { MediaService } from "../media.service";

/**
 * Media pipeline processors (§12.2–12.4). Each downloads the staged source from
 * R2, runs the FFmpeg/Sharp encode, uploads the derived assets, persists keys on
 * the lesson, then emits a domain event. Registered on the QueuePort at init, so
 * the SAME logic runs under BullMQ (durable) or in-process (free tier).
 */
@Injectable()
export class MediaWorkers implements OnModuleInit {
	private readonly logger = new Logger(MediaWorkers.name);

	constructor(
		@Inject(QUEUE_PORT) private readonly queue: QueuePort,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
		@Inject(MEDIA_ENCODER_PORT) private readonly encoder: MediaEncoderPort,
		private readonly prisma: PrismaService,
		private readonly events: EventEmitter2,
		private readonly media: MediaService,
	) {}

	onModuleInit(): void {
		this.queue.register<VideoJobData>(
			QUEUE_VIDEO,
			(data, ctx) => this.processVideo(data, ctx),
			{ concurrency: 1 },
		);
		this.queue.register<AudioJobData>(
			QUEUE_AUDIO,
			(data, ctx) => this.processAudio(data, ctx),
			{ concurrency: 1 },
		);
		this.queue.register<CaptionJobData>(QUEUE_CAPTION, (data, ctx) =>
			this.processCaption(data, ctx),
		);
	}

	private async processVideo(
		data: VideoJobData,
		ctx: JobContext,
	): Promise<void> {
		await ctx.updateProgress(5);
		const source = await this.storage.getObject(data.sourceKey);
		await ctx.updateProgress(10);
		const renditions = await this.encoder.encodeVideoRenditions(
			source,
			data.sourceExt,
		);
		await ctx.updateProgress(70);
		const videoKeys: Record<string, string> = {};
		for (const [index, rendition] of renditions.entries()) {
			const key = `videos/${data.lessonId}/${rendition.quality}.mp4`;
			await this.storage.putObject(key, rendition.data, "video/mp4");
			videoKeys[rendition.quality] = key;
			await ctx.updateProgress(
				70 + Math.round(((index + 1) / renditions.length) * 18),
			);
		}

		await ctx.updateProgress(90);
		const thumbnail = await this.encoder.extractThumbnailWebp(
			source,
			data.sourceExt,
			thumbnailSeekSeconds(data.durationSec),
		);
		const thumbnailKey = `videos/${data.lessonId}/thumbnail.webp`;
		await this.storage.putObject(thumbnailKey, thumbnail, "image/webp");
		await ctx.updateProgress(95);

		const lesson = await this.prisma.lesson.update({
			where: { id: data.lessonId },
			data: { videoKeysJson: videoKeys, videoThumbnailKey: thumbnailKey },
			select: { videoDurationSec: true },
		});
		await this.safeDelete(data.sourceKey);
		await ctx.updateProgress(100);

		this.events.emit(ContentEvents.VideoEncoded, {
			lessonId: data.lessonId,
			videoKeys,
			thumbnailKey,
			durationSec: lesson.videoDurationSec ?? 0,
		} satisfies VideoEncodedEvent);
	}

	private async processAudio(
		data: AudioJobData,
		ctx: JobContext,
	): Promise<void> {
		await ctx.updateProgress(10);
		const source = await this.storage.getObject(data.sourceKey);
		await ctx.updateProgress(25);
		const encoded = await this.encoder.encodeAudioAac(source, data.sourceExt);
		await ctx.updateProgress(75);
		const audioKey = `audio/${data.lessonId}/primary.m4a`;
		await this.storage.putObject(audioKey, encoded, "audio/mp4");
		await ctx.updateProgress(90);

		const lesson = await this.prisma.lesson.update({
			where: { id: data.lessonId },
			data: { audioKey, audioSizeBytes: BigInt(encoded.length) },
			select: { audioDurationSec: true },
		});
		await this.safeDelete(data.sourceKey);
		await ctx.updateProgress(100);

		this.events.emit(ContentEvents.AudioEncoded, {
			lessonId: data.lessonId,
			audioKey,
			durationSec: lesson.audioDurationSec ?? 0,
			sizeBytes: encoded.length,
		} satisfies AudioEncodedEvent);
	}

	private async processCaption(
		data: CaptionJobData,
		ctx: JobContext,
	): Promise<void> {
		await ctx.updateProgress(20);
		const source = await this.storage.getObject(data.sourceKey);
		await ctx.updateProgress(45);
		const vtt = await this.encoder.convertSrtToVtt(source);
		await ctx.updateProgress(70);
		const vttKey = `captions/${data.lessonId}/${data.languageCode}.vtt`;
		await this.storage.putObject(vttKey, vtt, "text/vtt");
		await ctx.updateProgress(85);
		await this.media.storeCaption(
			data.lessonId,
			data.languageCode,
			vttKey,
			data.uploadedBy,
		);
		await this.safeDelete(data.sourceKey);
		await ctx.updateProgress(100);

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
