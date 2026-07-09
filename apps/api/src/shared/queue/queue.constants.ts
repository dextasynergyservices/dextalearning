/** BullMQ queue names (§6.1 worker layer) and their DI tokens. */
export const QUEUE_VIDEO = "video";
export const QUEUE_AUDIO = "audio";
export const QUEUE_CAPTION = "caption";
export const QUEUE_REMINDERS = "reminders";

export const QUEUE_CONNECTION = Symbol("QUEUE_CONNECTION");
export const VIDEO_QUEUE = Symbol("VIDEO_QUEUE");
export const AUDIO_QUEUE = Symbol("AUDIO_QUEUE");
export const CAPTION_QUEUE = Symbol("CAPTION_QUEUE");
export const REMINDERS_QUEUE = Symbol("REMINDERS_QUEUE");

export interface VideoJobData {
	lessonId: string;
	sourceKey: string;
	sourceExt: string;
	/** Probed at upload time — lets the worker pick a safe thumbnail seek point. */
	durationSec: number;
}

export interface AudioJobData {
	lessonId: string;
	sourceKey: string;
	sourceExt: string;
}

export interface CaptionJobData {
	lessonId: string;
	languageCode: "en" | "fr" | "es" | "pcm";
	sourceKey: string;
	isSrt: boolean;
	uploadedBy: string;
}
