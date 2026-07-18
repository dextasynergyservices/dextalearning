import {
	ForbiddenException,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { MediaService } from "../../src/modules/media/media.service";
import { ContentEvents } from "../../src/shared/events/content-events";
import { getTestPrisma } from "./support/db";
import { createLesson, createModule, createUser } from "./support/factories";
import { FakeMediaEncoderAdapter } from "./support/fakes/fake-media-encoder.adapter";
import { FakeQueuePort } from "./support/fakes/fake-queue";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

function asAuthenticatedUser(
	id: string,
	role: AuthenticatedUser["role"] = "instructor",
): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role };
}

function buildService(durationSeconds = 120) {
	const prisma = getTestPrisma();
	const events = new EventEmitter2();
	const service = new MediaService(
		prisma,
		events,
		new FakeStorageAdapter(),
		new FakeMediaEncoderAdapter(durationSeconds),
		new FakeQueuePort(),
	);
	return { prisma, service, events };
}

describe("MediaService (integration)", () => {
	let ownerId: string;
	let otherId: string;

	beforeEach(async () => {
		const { prisma } = buildService();
		ownerId = (await createUser(prisma, { role: "instructor" })).id;
		otherId = (await createUser(prisma, { role: "instructor" })).id;
	});

	describe("ownership", () => {
		it("forbids a non-owner from uploading media to someone else's lesson", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "media-course", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			await expect(
				service.uploadVideo(lesson.id, asAuthenticatedUser(otherId), {
					buffer: Buffer.from("data"),
					originalname: "video.mp4",
					mimetype: "video/mp4",
					size: 1000,
				}),
			).rejects.toThrow(ForbiddenException);
		});

		it("resolves ownership via the path a standalone intro lesson belongs to", async () => {
			const { prisma, service } = buildService();
			const path = await prisma.learningPath.create({
				data: { title: "Path", slug: "media-path", createdBy: ownerId },
			});
			const intro = await prisma.lesson.create({
				data: { introForPathId: path.id, title: "Intro", orderIndex: 0 },
			});
			await expect(
				service.uploadVideo(intro.id, asAuthenticatedUser(otherId), {
					buffer: Buffer.from("data"),
					originalname: "video.mp4",
					mimetype: "video/mp4",
					size: 1000,
				}),
			).rejects.toThrow(ForbiddenException);
			await expect(
				service.uploadVideo(intro.id, asAuthenticatedUser(ownerId), {
					buffer: Buffer.from("data"),
					originalname: "video.mp4",
					mimetype: "video/mp4",
					size: 1000,
				}),
			).resolves.toBeTruthy();
		});
	});

	describe("uploadVideo", () => {
		it("rejects an unsupported file extension", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "video-ext", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			await expect(
				service.uploadVideo(lesson.id, asAuthenticatedUser(ownerId), {
					buffer: Buffer.from("data"),
					originalname: "video.txt",
					mimetype: "text/plain",
					size: 1000,
				}),
			).rejects.toThrow(UnprocessableEntityException);
		});

		it("rejects a video exceeding the 15-minute guardrail", async () => {
			const { prisma, service } = buildService(1000); // > 900s
			const course = await prisma.course.create({
				data: { title: "Course", slug: "video-duration", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			await expect(
				service.uploadVideo(lesson.id, asAuthenticatedUser(ownerId), {
					buffer: Buffer.from("data"),
					originalname: "video.mp4",
					mimetype: "video/mp4",
					size: 1000,
				}),
			).rejects.toThrow(UnprocessableEntityException);
		});

		it("stores the source, updates the lesson, and enqueues an encode job", async () => {
			const { prisma, service } = buildService(120);
			const course = await prisma.course.create({
				data: { title: "Course", slug: "video-ok", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			const result = await service.uploadVideo(
				lesson.id,
				asAuthenticatedUser(ownerId),
				{
					buffer: Buffer.from("data"),
					originalname: "video.mp4",
					mimetype: "video/mp4",
					size: 1000,
				},
			);
			expect(result.status).toBe("processing");
			expect(result.durationSec).toBe(120);
			const updated = await prisma.lesson.findUnique({
				where: { id: lesson.id },
			});
			expect(updated?.contentType).toBe("video");
			expect(updated?.videoDurationSec).toBe(120);
		});
	});

	describe("uploadPdf", () => {
		it("rasterises pages and stores the pdf key", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "pdf-course", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			const result = await service.uploadPdf(
				lesson.id,
				asAuthenticatedUser(ownerId),
				{
					buffer: Buffer.from("%PDF-1.4"),
					originalname: "doc.pdf",
					mimetype: "application/pdf",
					size: 1000,
				},
			);
			expect(result.status).toBe("ready");
			expect(result.pageCount).toBe(1);
			const updated = await prisma.lesson.findUnique({
				where: { id: lesson.id },
			});
			expect(updated?.pdfKey).toBe(`pdfs/${lesson.id}/document.pdf`);
		});
	});

	describe("uploadCaption", () => {
		it("rejects an invalid caption format (no cue timing)", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "caption-invalid", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			await expect(
				service.uploadCaption(lesson.id, asAuthenticatedUser(ownerId), "en", {
					buffer: Buffer.from("not a real vtt file"),
					originalname: "captions.vtt",
					mimetype: "text/vtt",
					size: 100,
				}),
			).rejects.toThrow(UnprocessableEntityException);
		});

		it("normalizes and stores a valid VTT caption", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "caption-valid", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			const result = await service.uploadCaption(
				lesson.id,
				asAuthenticatedUser(ownerId),
				"en",
				{
					buffer: Buffer.from("00:00:01.000 --> 00:00:02.000\nHello world."),
					originalname: "captions.vtt",
					mimetype: "text/vtt",
					size: 100,
				},
			);
			expect(result.status).toBe("ready");
			const caption = await prisma.lessonCaption.findUnique({
				where: {
					lessonId_languageCode: { lessonId: lesson.id, languageCode: "en" },
				},
			});
			expect(caption).not.toBeNull();
			const updated = await prisma.lesson.findUnique({
				where: { id: lesson.id },
			});
			expect((updated?.captionKeysJson as Record<string, string>)?.en).toBe(
				`captions/${lesson.id}/en.vtt`,
			);
		});
	});

	describe("removeMedia + removeCaption", () => {
		it("clears the video fields on removal", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "remove-video", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
			});
			await prisma.lesson.update({
				where: { id: lesson.id },
				data: { videoDurationSec: 100 },
			});
			await service.removeMedia(
				lesson.id,
				asAuthenticatedUser(ownerId),
				"video",
			);
			const updated = await prisma.lesson.findUnique({
				where: { id: lesson.id },
			});
			expect(updated?.videoDurationSec).toBeNull();
		});

		it("removes a single-language caption without disturbing others", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "remove-caption", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			await service.storeCaption(lesson.id, "en", "captions/x/en.vtt", ownerId);
			await service.storeCaption(lesson.id, "fr", "captions/x/fr.vtt", ownerId);
			await service.removeCaption(
				lesson.id,
				asAuthenticatedUser(ownerId),
				"en",
			);
			const updated = await prisma.lesson.findUnique({
				where: { id: lesson.id },
			});
			const keys = updated?.captionKeysJson as Record<string, string>;
			expect(keys.en).toBeUndefined();
			expect(keys.fr).toBe("captions/x/fr.vtt");
		});
	});

	describe("updateTranscript", () => {
		it("derives flat text from timed cues and emits TranscriptUpdated", async () => {
			const { prisma, service, events } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "transcript-timed", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			const handler = vi.fn();
			events.on(ContentEvents.TranscriptUpdated, handler);

			await service.updateTranscript(
				lesson.id,
				asAuthenticatedUser(ownerId),
				"",
				[
					{ start: 0, end: 1, text: "Hello" },
					{ start: 1, end: 2, text: "world" },
				],
			);
			const updated = await prisma.lesson.findUnique({
				where: { id: lesson.id },
			});
			expect(updated?.transcriptText).toBe("Hello\nworld");
			// The event snapshots the transcript + title + course for the RAG indexer.
			expect(handler).toHaveBeenCalledWith({
				lessonId: lesson.id,
				lessonTitle: lesson.title,
				transcriptText: "Hello\nworld",
				courseId: course.id,
			});
		});

		it("stores plain text and clears cues when no timed cues are given", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "transcript-plain", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			await service.updateTranscript(
				lesson.id,
				asAuthenticatedUser(ownerId),
				"Plain transcript",
			);
			const updated = await prisma.lesson.findUnique({
				where: { id: lesson.id },
			});
			expect(updated?.transcriptText).toBe("Plain transcript");
			expect(updated?.transcriptCuesJson).toBeNull();
		});
	});

	describe("media tokens", () => {
		it("getPreviewMediaToken 404s when the lesson isn't a preview", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "preview-course", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "text",
			});
			await expect(service.getPreviewMediaToken(lesson.id)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("getPreviewMediaToken serves a text lesson once flagged preview on a published course", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: {
					title: "Course",
					slug: "preview-course-2",
					createdBy: ownerId,
					status: "published",
				},
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "text",
			});
			await prisma.lesson.update({
				where: { id: lesson.id },
				data: { isPreview: true, contentText: "Free preview text" },
			});
			const token = await service.getPreviewMediaToken(lesson.id);
			expect(token).toEqual({
				type: "text",
				contentText: "Free preview text",
				transcriptText: null,
			});
		});

		it("getIntroMediaToken 404s for an intro on a non-published path", async () => {
			const { prisma, service } = buildService();
			const path = await prisma.learningPath.create({
				data: { title: "Path", slug: "intro-token-path", status: "draft" },
			});
			const intro = await prisma.lesson.create({
				data: { introForPathId: path.id, title: "Intro", orderIndex: 0 },
			});
			await expect(service.getIntroMediaToken(intro.id)).rejects.toThrow(
				NotFoundException,
			);
		});

		it("getMediaToken requires the lesson to exist", async () => {
			const { service } = buildService();
			await expect(
				service.getMediaToken(
					"00000000-0000-0000-0000-000000000000",
					asAuthenticatedUser(ownerId),
				),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe("getMediaJobStatus", () => {
		it("reports not_found with 0% when there's no job and nothing ready", async () => {
			const { prisma, service } = buildService();
			const course = await prisma.course.create({
				data: { title: "Course", slug: "job-status", createdBy: ownerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id);
			const status = await service.getMediaJobStatus(
				lesson.id,
				asAuthenticatedUser(ownerId),
				"video",
			);
			expect(status.state).toBe("not_found");
			expect(status.progress).toBe(0);
		});
	});
});
