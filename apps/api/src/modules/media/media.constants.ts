/** Accepted upload formats + the 15-minute guardrail (§12.1). */
export const MAX_MEDIA_DURATION_SECONDS = 900; // 15 minutes

export const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv", "avi"] as const;
export const AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "aac"] as const;
export const CAPTION_EXTENSIONS = ["vtt", "srt"] as const;

export const MAX_VIDEO_BYTES = 700 * 1024 * 1024; // 700 MB source ceiling
export const MAX_AUDIO_BYTES = 120 * 1024 * 1024;
export const MAX_CAPTION_BYTES = 2 * 1024 * 1024;

export const LANGUAGE_CODES = ["en", "fr", "es", "pcm"] as const;
export type SupportedLanguage = (typeof LANGUAGE_CODES)[number];

/** Minimal shape of a Multer upload — avoids a hard dependency on @types/multer. */
export interface UploadFile {
	buffer: Buffer;
	originalname: string;
	mimetype: string;
	size: number;
}

/** Lowercased file extension without the dot, from a filename. */
export function extensionOf(filename: string): string {
	const dot = filename.lastIndexOf(".");
	return dot === -1 ? "" : filename.slice(dot + 1).toLowerCase();
}
