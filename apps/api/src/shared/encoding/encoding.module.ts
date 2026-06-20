import { Global, Module } from "@nestjs/common";
import { FfmpegEncoderAdapter } from "./ffmpeg-encoder.adapter";
import { MEDIA_ENCODER_PORT } from "./media-encoder.port";

/** Binds `MediaEncoderPort` to the FFmpeg/Sharp adapter (global — §6.4). */
@Global()
@Module({
	providers: [{ provide: MEDIA_ENCODER_PORT, useClass: FfmpegEncoderAdapter }],
	exports: [MEDIA_ENCODER_PORT],
})
export class EncodingModule {}
