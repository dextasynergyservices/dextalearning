/**
 * Media-encoding abstraction (hexagonal port — §6.4). Injected via
 * `MEDIA_ENCODER_PORT`; the FFmpeg/Sharp adapter is the swappable implementation.
 * Workers depend on this interface, never on fluent-ffmpeg directly.
 */
export const MEDIA_ENCODER_PORT = Symbol("MEDIA_ENCODER_PORT");

export type VideoQualityLabel =
	| "1080p"
	| "720p"
	| "480p"
	| "320p"
	| "240p"
	| "144p";

/** §5.6 — the six encoding rungs, widths and target video bitrates. */
export const VIDEO_RENDITIONS: {
	quality: VideoQualityLabel;
	width: number;
	height: number;
	videoBitrateKbps: number;
}[] = [
	{ quality: "1080p", width: 1920, height: 1080, videoBitrateKbps: 2500 },
	{ quality: "720p", width: 1280, height: 720, videoBitrateKbps: 1500 },
	{ quality: "480p", width: 854, height: 480, videoBitrateKbps: 800 },
	{ quality: "320p", width: 568, height: 320, videoBitrateKbps: 400 },
	{ quality: "240p", width: 426, height: 240, videoBitrateKbps: 250 },
	{ quality: "144p", width: 256, height: 144, videoBitrateKbps: 100 },
];

export interface EncodedRendition {
	quality: VideoQualityLabel;
	data: Buffer;
}

export interface MediaEncoderPort {
	/** Source duration in whole seconds (for the 15-min / 900s guardrail). */
	probeDurationSeconds(input: Buffer, sourceExt: string): Promise<number>;
	/** Encode the source into the six MP4 renditions (§12.2). */
	encodeVideoRenditions(
		input: Buffer,
		sourceExt: string,
	): Promise<EncodedRendition[]>;
	/** Grab a frame and return a WebP thumbnail (§12.2 — frame at ~5s → Sharp). */
	extractThumbnailWebp(
		input: Buffer,
		sourceExt: string,
		atSeconds: number,
	): Promise<Buffer>;
	/** Encode audio to AAC 128 kbps, loudness-normalised to -16 LUFS (§12.3). */
	encodeAudioAac(input: Buffer, sourceExt: string): Promise<Buffer>;
	/**
	 * Extract a small, mono, low-bitrate AAC track from any audio/video source —
	 * used to feed lesson media to the AI cheaply (speech only, no video frames),
	 * keeping the request well under inline-upload limits.
	 */
	extractAudioForAi(input: Buffer, sourceExt: string): Promise<Buffer>;
	/** Convert an uploaded `.srt` caption to `.vtt` (§12.4). */
	convertSrtToVtt(srt: Buffer): Promise<Buffer>;
	/** Rasterise each PDF page to a WebP image (§4.2 — no-download PDF viewing). */
	rasterizePdfToWebp(pdf: Buffer): Promise<Buffer[]>;
}
