/**
 * Domain event contracts for the content/media bounded contexts (§6.4). Contexts
 * publish/subscribe to these names via `@nestjs/event-emitter` and import the
 * contract — never each other. Keep names stable; payloads are append-only.
 */
export const ContentEvents = {
	VideoEncoded: "media.video.encoded",
	AudioEncoded: "media.audio.encoded",
	CaptionReady: "media.caption.ready",
	TranscriptUpdated: "media.transcript.updated",
	LessonPublished: "content.lesson.published",
} as const;

export interface VideoEncodedEvent {
	lessonId: string;
	videoKeys: Record<string, string>;
	thumbnailKey: string;
	durationSec: number;
}

export interface AudioEncodedEvent {
	lessonId: string;
	audioKey: string;
	durationSec: number;
	sizeBytes: number;
}

export interface CaptionReadyEvent {
	lessonId: string;
	languageCode: "en" | "fr" | "es" | "pcm";
	vttKey: string;
}

export interface TranscriptUpdatedEvent {
	lessonId: string;
	/** Snapshot of the lesson title (shown in search results, §6.4 rule 5). */
	lessonTitle: string;
	/** Snapshot of the flat transcript text (RAG indexing source, §4.10). */
	transcriptText: string;
	/** The lesson's course, for scoping semantic search. */
	courseId: string | null;
}

export interface LessonPublishedEvent {
	lessonId: string;
	moduleId: string;
}
