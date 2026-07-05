import type {
	EncodedRendition,
	MediaEncoderPort,
	VideoQualityLabel,
} from "../../../../src/shared/encoding/media-encoder.port";

/** No-op `MediaEncoderPort` for integration tests — no real ffmpeg calls. */
export class FakeMediaEncoderAdapter implements MediaEncoderPort {
	constructor(private readonly durationSeconds = 120) {}

	async probeDurationSeconds(): Promise<number> {
		return this.durationSeconds;
	}

	async encodeVideoRenditions(): Promise<EncodedRendition[]> {
		const quality: VideoQualityLabel = "144p";
		return [{ quality, data: Buffer.from("fake-video") }];
	}

	async extractThumbnailWebp(): Promise<Buffer> {
		return Buffer.from("fake-thumbnail");
	}

	async encodeAudioAac(): Promise<Buffer> {
		return Buffer.from("fake-audio");
	}

	async extractAudioForAi(): Promise<Buffer> {
		return Buffer.from("fake-audio-for-ai");
	}

	async convertSrtToVtt(): Promise<Buffer> {
		return Buffer.from("fake-vtt");
	}

	async rasterizePdfToWebp(): Promise<Buffer[]> {
		return [Buffer.from("fake-page")];
	}
}
