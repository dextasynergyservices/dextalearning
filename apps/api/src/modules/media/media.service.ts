import { randomUUID } from "node:crypto";
import {
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { Job, JobType, Queue } from "bullmq";
import { Prisma } from "../../../generated/prisma/client";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import {
	MEDIA_ENCODER_PORT,
	type MediaEncoderPort,
} from "../../shared/encoding/media-encoder.port";
import {
	ContentEvents,
	type TranscriptUpdatedEvent,
} from "../../shared/events/content-events";
import {
	AUDIO_QUEUE,
	CAPTION_QUEUE,
	VIDEO_QUEUE,
} from "../../shared/queue/queue.constants";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import {
	AUDIO_EXTENSIONS,
	CAPTION_EXTENSIONS,
	extensionOf,
	LANGUAGE_CODES,
	MAX_MEDIA_DURATION_SECONDS,
	type SupportedLanguage,
	type UploadFile,
	VIDEO_EXTENSIONS,
} from "./media.constants";

const PRESIGN_2H = { expiresInSeconds: 2 * 60 * 60 };
const JOB_STATUS_TYPES: JobType[] = [
	"active",
	"waiting",
	"delayed",
	"prioritized",
	"completed",
	"failed",
];

type MediaJobKind = "video" | "audio" | "caption";

const CAPTION_CUE_TIMING =
	/(?:^|\n)\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/;

@Injectable()
export class MediaService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly events: EventEmitter2,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
		@Inject(MEDIA_ENCODER_PORT) private readonly encoder: MediaEncoderPort,
		@Inject(VIDEO_QUEUE) private readonly videoQueue: Queue,
		@Inject(AUDIO_QUEUE) private readonly audioQueue: Queue,
		@Inject(CAPTION_QUEUE) private readonly captionQueue: Queue,
	) {}

	/**
	 * Loads a lesson and asserts the user may edit it. A normal lesson is owned
	 * via its course creator; a standalone **intro lesson** (no module) is owned
	 * via the path/cohort it introduces.
	 */
	private async loadEditableLesson(lessonId: string, user: AuthenticatedUser) {
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
			include: {
				module: { include: { course: true } },
				introForPath: { select: { createdBy: true } },
				introForCohort: { select: { createdBy: true } },
			},
		});
		if (!lesson) throw new NotFoundException("Lesson not found");
		const ownerId =
			lesson.module?.course.createdBy ??
			lesson.introForPath?.createdBy ??
			lesson.introForCohort?.createdBy ??
			null;
		if (user.role !== "admin" && ownerId !== user.id) {
			throw new ForbiddenException("You do not own this content");
		}
		return lesson;
	}

	private assertExtension(
		file: UploadFile,
		allowed: readonly string[],
	): string {
		const ext = extensionOf(file.originalname);
		if (!allowed.includes(ext)) {
			throw new UnprocessableEntityException({
				code: "UNSUPPORTED_MEDIA_FORMAT",
				message: "errors.media.unsupported_format",
				details: { allowed, received: ext || file.mimetype },
			});
		}
		return ext;
	}

	async uploadVideo(
		lessonId: string,
		user: AuthenticatedUser,
		file: UploadFile,
	) {
		await this.loadEditableLesson(lessonId, user);
		const ext = this.assertExtension(file, VIDEO_EXTENSIONS);

		const durationSec = await this.encoder.probeDurationSeconds(
			file.buffer,
			ext,
		);
		if (durationSec > MAX_MEDIA_DURATION_SECONDS) {
			throw new UnprocessableEntityException({
				code: "MEDIA_DURATION_EXCEEDED",
				message: "errors.media.duration_exceeded",
				details: {
					maxSeconds: MAX_MEDIA_DURATION_SECONDS,
					actualSeconds: durationSec,
				},
			});
		}

		const sourceKey = `uploads/source/${lessonId}/video-${randomUUID()}.${ext}`;
		await this.storage.putObject(sourceKey, file.buffer, file.mimetype);
		await this.prisma.lesson.update({
			where: { id: lessonId },
			data: { contentType: "video", videoDurationSec: durationSec },
		});
		const job = await this.videoQueue.add(
			"encode",
			{
				lessonId,
				sourceKey,
				sourceExt: ext,
				durationSec,
			},
			{
				removeOnComplete: 50,
				removeOnFail: 50,
			},
		);

		return { status: "processing" as const, durationSec, jobId: job.id };
	}

	async uploadAudio(
		lessonId: string,
		user: AuthenticatedUser,
		file: UploadFile,
	) {
		await this.loadEditableLesson(lessonId, user);
		const ext = this.assertExtension(file, AUDIO_EXTENSIONS);

		const durationSec = await this.encoder.probeDurationSeconds(
			file.buffer,
			ext,
		);
		if (durationSec > MAX_MEDIA_DURATION_SECONDS) {
			throw new UnprocessableEntityException({
				code: "MEDIA_DURATION_EXCEEDED",
				message: "errors.media.duration_exceeded",
				details: {
					maxSeconds: MAX_MEDIA_DURATION_SECONDS,
					actualSeconds: durationSec,
				},
			});
		}

		const sourceKey = `uploads/source/${lessonId}/audio-${randomUUID()}.${ext}`;
		await this.storage.putObject(sourceKey, file.buffer, file.mimetype);
		await this.prisma.lesson.update({
			where: { id: lessonId },
			data: { contentType: "audio", audioDurationSec: durationSec },
		});
		const job = await this.audioQueue.add(
			"encode",
			{
				lessonId,
				sourceKey,
				sourceExt: ext,
			},
			{
				removeOnComplete: 50,
				removeOnFail: 50,
			},
		);

		return { status: "processing" as const, durationSec, jobId: job.id };
	}

	async uploadPdf(lessonId: string, user: AuthenticatedUser, file: UploadFile) {
		await this.loadEditableLesson(lessonId, user);
		this.assertExtension(file, ["pdf"]);

		// Replace any previously rasterised pages on re-upload.
		const stale = await this.storage.listKeys(`pdfs/${lessonId}/page-`);
		await Promise.all(
			stale.map((key) => this.storage.deleteObject(key).catch(() => {})),
		);

		const pdfKey = `pdfs/${lessonId}/document.pdf`;
		await this.storage.putObject(pdfKey, file.buffer, "application/pdf");

		// Rasterise to WebP page images so learners view (not download) the PDF (§4.2).
		const pages = await this.encoder.rasterizePdfToWebp(file.buffer);
		await Promise.all(
			pages.map((png, index) =>
				this.storage.putObject(
					`pdfs/${lessonId}/page-${String(index + 1).padStart(4, "0")}.webp`,
					png,
					"image/webp",
				),
			),
		);

		await this.prisma.lesson.update({
			where: { id: lessonId },
			data: { contentType: "pdf", pdfKey },
		});
		return { status: "ready" as const, pageCount: pages.length };
	}

	async uploadCaption(
		lessonId: string,
		user: AuthenticatedUser,
		language: SupportedLanguage,
		file: UploadFile,
	) {
		await this.loadEditableLesson(lessonId, user);
		if (!LANGUAGE_CODES.includes(language)) {
			throw new UnprocessableEntityException({
				code: "UNSUPPORTED_LANGUAGE",
				message: "errors.media.unsupported_language",
			});
		}
		const ext = this.assertExtension(file, CAPTION_EXTENSIONS);

		if (ext === "vtt") {
			const vtt = this.normaliseWebVtt(file.buffer);
			const vttKey = `captions/${lessonId}/${language}.vtt`;
			await this.storage.putObject(vttKey, vtt, "text/vtt");
			await this.storeCaption(lessonId, language, vttKey, user.id);
			return { status: "ready" as const, language };
		}

		// .srt → enqueue conversion (§12.4 caption.queue)
		const sourceKey = `uploads/source/${lessonId}/caption-${language}-${randomUUID()}.srt`;
		await this.storage.putObject(
			sourceKey,
			file.buffer,
			"application/x-subrip",
		);
		const job = await this.captionQueue.add(
			"convert",
			{
				lessonId,
				languageCode: language,
				sourceKey,
				isSrt: true,
				uploadedBy: user.id,
			},
			{
				removeOnComplete: 50,
				removeOnFail: 50,
			},
		);
		return { status: "processing" as const, language, jobId: job.id };
	}

	private normaliseWebVtt(input: Buffer): Buffer {
		const text = input
			.toString("utf8")
			.replace(/^\uFEFF/, "")
			.replace(/\r\n?/g, "\n")
			.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
			.trim();
		const hasHeader = /^WEBVTT(?:[ \t].*)?(?:\n|$)/i.test(text);
		const vtt = hasHeader ? text : `WEBVTT\n\n${text}`;

		if (!CAPTION_CUE_TIMING.test(vtt)) {
			throw new UnprocessableEntityException({
				code: "INVALID_CAPTION_FORMAT",
				message: "errors.media.invalid_caption_format",
				details: {
					expected: "WEBVTT captions with at least one cue timing",
				},
			});
		}

		return Buffer.from(`${vtt}\n`, "utf8");
	}

	async getMediaJobStatus(
		lessonId: string,
		user: AuthenticatedUser,
		kind: MediaJobKind,
	) {
		const lesson = await this.loadEditableLesson(lessonId, user);
		const ready =
			(kind === "video" && Boolean(lesson.videoKeysJson)) ||
			(kind === "audio" && Boolean(lesson.audioKey)) ||
			(kind === "caption" && Boolean(lesson.captionKeysJson));
		const queue = this.queueForKind(kind);
		const job = await this.findLatestJob(queue, lessonId);
		if (!job) {
			return {
				kind,
				state: ready ? "completed" : "not_found",
				progress: ready ? 100 : 0,
				jobId: null,
				failedReason: null,
			};
		}
		const state = await job.getState();
		return {
			kind,
			state,
			progress: this.normaliseProgress(job.progress, ready),
			jobId: job.id,
			failedReason: job.failedReason || null,
			processedOn: job.processedOn ?? null,
			finishedOn: job.finishedOn ?? null,
		};
	}

	private queueForKind(kind: MediaJobKind): Queue {
		if (kind === "video") return this.videoQueue;
		if (kind === "audio") return this.audioQueue;
		return this.captionQueue;
	}

	private async findLatestJob(
		queue: Queue,
		lessonId: string,
	): Promise<Job | null> {
		const jobs = await queue.getJobs(JOB_STATUS_TYPES, 0, 50, false);
		const matches = jobs.filter((job) => {
			const data = job.data as { lessonId?: string };
			return data.lessonId === lessonId;
		});
		matches.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
		return matches[0] ?? null;
	}

	private normaliseProgress(progress: Job["progress"], ready: boolean): number {
		if (typeof progress === "number")
			return Math.max(0, Math.min(100, progress));
		if (ready) return 100;
		return 0;
	}

	/** Upserts a caption record + the lesson's caption map. Called by the worker too. */
	async storeCaption(
		lessonId: string,
		language: SupportedLanguage,
		vttKey: string,
		uploadedBy: string,
	): Promise<void> {
		await this.prisma.lessonCaption.upsert({
			where: { lessonId_languageCode: { lessonId, languageCode: language } },
			create: { lessonId, languageCode: language, vttKey, uploadedBy },
			update: { vttKey, uploadedBy, uploadedAt: new Date() },
		});
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
			select: { captionKeysJson: true },
		});
		const keys = {
			...((lesson?.captionKeysJson as Record<string, string | null>) ?? {}),
			[language]: vttKey,
		};
		await this.prisma.lesson.update({
			where: { id: lessonId },
			data: { captionKeysJson: keys },
		});
	}

	private async deletePrefix(prefix: string): Promise<void> {
		const keys = await this.storage.listKeys(prefix);
		await Promise.all(
			keys.map((key) => this.storage.deleteObject(key).catch(() => {})),
		);
	}

	/** Removes a lesson's media of a given kind (R2 objects + DB keys). */
	async removeMedia(
		lessonId: string,
		user: AuthenticatedUser,
		kind: "video" | "audio" | "pdf",
	) {
		await this.loadEditableLesson(lessonId, user);
		if (kind === "video") {
			await this.deletePrefix(`videos/${lessonId}/`);
			await this.prisma.lesson.update({
				where: { id: lessonId },
				data: {
					videoKeysJson: Prisma.DbNull,
					videoThumbnailKey: null,
					videoDurationSec: null,
				},
			});
		} else if (kind === "audio") {
			await this.deletePrefix(`audio/${lessonId}/`);
			await this.prisma.lesson.update({
				where: { id: lessonId },
				data: { audioKey: null, audioSizeBytes: null, audioDurationSec: null },
			});
		} else {
			await this.deletePrefix(`pdfs/${lessonId}/`);
			await this.prisma.lesson.update({
				where: { id: lessonId },
				data: { pdfKey: null },
			});
		}
		return { removed: true as const };
	}

	/** Removes a single language caption (R2 + record + lesson map). */
	async removeCaption(
		lessonId: string,
		user: AuthenticatedUser,
		language: SupportedLanguage,
	) {
		await this.loadEditableLesson(lessonId, user);
		await this.storage
			.deleteObject(`captions/${lessonId}/${language}.vtt`)
			.catch(() => {});
		await this.prisma.lessonCaption.deleteMany({
			where: { lessonId, languageCode: language },
		});
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
			select: { captionKeysJson: true },
		});
		const keys = {
			...((lesson?.captionKeysJson as Record<string, string | null>) ?? {}),
		};
		delete keys[language];
		await this.prisma.lesson.update({
			where: { id: lessonId },
			data: { captionKeysJson: keys },
		});
		return { removed: true as const };
	}

	async updateTranscript(
		lessonId: string,
		user: AuthenticatedUser,
		text: string,
		cues?: { start: number; end: number; text: string }[],
	) {
		await this.loadEditableLesson(lessonId, user);
		// Timed cues are the authoritative transcript when supplied — the flat
		// `transcriptText` (publish gate + AI source) is derived from them so the
		// two never drift. A plain-text save clears any timing (untimed mode).
		const timed = cues && cues.length > 0;
		const flatText = timed ? cues.map((c) => c.text.trim()).join("\n") : text;
		const updated = await this.prisma.lesson.update({
			where: { id: lessonId },
			data: {
				transcriptText: flatText,
				transcriptCuesJson: timed ? cues : Prisma.DbNull,
				transcriptUploadedAt: new Date(),
			},
			select: {
				id: true,
				title: true,
				transcriptUploadedAt: true,
				module: { select: { courseId: true } },
			},
		});
		// Snapshot the transcript + title + course into the event so the knowledge
		// (RAG) context can (re)index without reading back into media (§6.4).
		this.events.emit(ContentEvents.TranscriptUpdated, {
			lessonId,
			lessonTitle: updated.title,
			transcriptText: flatText,
			courseId: updated.module?.courseId ?? null,
		} satisfies TranscriptUpdatedEvent);
		return {
			id: updated.id,
			transcriptUploadedAt: updated.transcriptUploadedAt,
		};
	}

	/**
	 * Public playback for a path/cohort INTRO lesson — no auth/enrolment. Serves
	 * the token only when the lesson is the intro of a published path or open
	 * cohort; otherwise indistinguishable from "not found".
	 */
	async getIntroMediaToken(lessonId: string) {
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
			include: {
				introForPath: { select: { status: true } },
				introForCohort: { select: { status: true } },
			},
		});
		const open =
			lesson?.introForPath?.status === "published" ||
			lesson?.introForCohort?.status === "open";
		if (!lesson || !open) throw new NotFoundException("Intro not available");
		return this.buildMediaToken(lesson, lessonId);
	}

	/** Presigned playback bundle (§12.6). Auth required; enrolment gating lands with payments. */
	async getMediaToken(lessonId: string, _user: AuthenticatedUser) {
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
		});
		if (!lesson) throw new NotFoundException("Lesson not found");
		return this.buildMediaToken(lesson, lessonId);
	}

	/**
	 * Public playback for a FREE-PREVIEW lesson (§2.4) — no auth/enrolment. Only
	 * serves the token when the lesson is flagged preview and its course is
	 * published; otherwise it is indistinguishable from "not found".
	 */
	async getPreviewMediaToken(lessonId: string) {
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
			include: { module: { select: { course: { select: { status: true } } } } },
		});
		if (!lesson?.isPreview || lesson.module?.course?.status !== "published") {
			throw new NotFoundException("Preview not available");
		}
		return this.buildMediaToken(lesson, lessonId);
	}

	private async buildMediaToken(
		lesson: {
			contentType: string | null;
			captionKeysJson: unknown;
			videoKeysJson: unknown;
			audioKey: string | null;
			contentText: string | null;
			transcriptText: string | null;
			transcriptCuesJson: unknown;
			videoDurationSec: number | null;
			audioDurationSec: number | null;
		},
		lessonId: string,
	) {
		const captionUrls = await this.signCaptions(
			(lesson.captionKeysJson as Record<string, string | null>) ?? {},
		);
		const transcriptCues =
			(lesson.transcriptCuesJson as
				| { start: number; end: number; text: string }[]
				| null) ?? null;

		if (lesson.contentType === "video") {
			const videoKeys = (lesson.videoKeysJson as Record<string, string>) ?? {};
			const qualities: Record<string, string> = {};
			for (const [quality, key] of Object.entries(videoKeys)) {
				qualities[quality] = await this.storage.getSignedDownloadUrl(
					key,
					PRESIGN_2H,
				);
			}
			return {
				type: "video" as const,
				qualities,
				defaultQuality: "480p",
				captionUrls,
				transcriptText: lesson.transcriptText,
				transcriptCues,
				duration: lesson.videoDurationSec,
			};
		}

		if (lesson.contentType === "audio") {
			return {
				type: "audio" as const,
				audioUrl: lesson.audioKey
					? await this.storage.getSignedDownloadUrl(lesson.audioKey, PRESIGN_2H)
					: null,
				captionUrls,
				transcriptText: lesson.transcriptText,
				transcriptCues,
				duration: lesson.audioDurationSec,
			};
		}

		if (lesson.contentType === "pdf") {
			const pageKeys = (
				await this.storage.listKeys(`pdfs/${lessonId}/page-`)
			).sort();
			const pages = await Promise.all(
				pageKeys.map((key) =>
					this.storage.getSignedDownloadUrl(key, PRESIGN_2H),
				),
			);
			return {
				type: "pdf" as const,
				pages,
				transcriptText: lesson.transcriptText,
			};
		}

		return {
			type: "text" as const,
			contentText: lesson.contentText,
			transcriptText: lesson.transcriptText,
		};
	}

	private async signCaptions(
		captionKeys: Record<string, string | null>,
	): Promise<Record<string, string | null>> {
		const out: Record<string, string | null> = {
			en: null,
			fr: null,
			es: null,
			pcm: null,
		};
		for (const lang of LANGUAGE_CODES) {
			const key = captionKeys[lang];
			out[lang] = key
				? await this.storage.getSignedDownloadUrl(key, PRESIGN_2H)
				: null;
		}
		return out;
	}
}
