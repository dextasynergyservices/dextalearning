import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import ffmpegPath from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import {
	type EncodedRendition,
	type MediaEncoderPort,
	VIDEO_RENDITIONS,
} from "./media-encoder.port";

// Use the bundled static binaries so encoding works without a system ffmpeg
// (local `bun run dev` and the container alike).
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const CAPTION_CUE_TIMING =
	/(?:^|\n)\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}/;

/**
 * FFmpeg + Sharp implementation of `MediaEncoderPort`. FFmpeg works on file
 * paths, so each operation stages the source in a throwaway temp dir, runs the
 * encode, reads the result back, and cleans up. The ffmpeg binary ships in the
 * API Docker image (and must be on PATH for local `bun run dev`).
 */
@Injectable()
export class FfmpegEncoderAdapter implements MediaEncoderPort {
	private async withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
		const dir = await mkdtemp(join(tmpdir(), "dexta-enc-"));
		try {
			return await fn(dir);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}

	private runFfmpeg(
		inputPath: string,
		configure: (cmd: ffmpeg.FfmpegCommand) => ffmpeg.FfmpegCommand,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			configure(ffmpeg(inputPath))
				.on("end", () => resolve())
				.on("error", (err: Error) => reject(err))
				.run();
		});
	}

	probeDurationSeconds(input: Buffer, sourceExt: string): Promise<number> {
		return this.withTempDir(async (dir) => {
			const inputPath = join(dir, `src.${sourceExt}`);
			await writeFile(inputPath, input);
			return new Promise<number>((resolve, reject) => {
				ffmpeg.ffprobe(inputPath, (err, data) => {
					if (err) {
						reject(err);
						return;
					}
					resolve(Math.round(data.format.duration ?? 0));
				});
			});
		});
	}

	encodeVideoRenditions(
		input: Buffer,
		sourceExt: string,
	): Promise<EncodedRendition[]> {
		return this.withTempDir(async (dir) => {
			const inputPath = join(dir, `src.${sourceExt}`);
			await writeFile(inputPath, input);

			const renditions: EncodedRendition[] = [];
			for (const r of VIDEO_RENDITIONS) {
				const outPath = join(dir, `${r.quality}.mp4`);
				await this.runFfmpeg(inputPath, (cmd) =>
					cmd
						.videoCodec("libx264")
						.audioCodec("aac")
						.audioBitrate("128k")
						.videoBitrate(`${r.videoBitrateKbps}k`)
						.outputOptions([
							"-preset veryfast",
							"-movflags +faststart",
							"-pix_fmt yuv420p",
							`-vf scale=${r.width}:${r.height}:force_original_aspect_ratio=decrease,pad=${r.width}:${r.height}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
						])
						.output(outPath),
				);
				renditions.push({ quality: r.quality, data: await readFile(outPath) });
			}
			return renditions;
		});
	}

	extractThumbnailWebp(
		input: Buffer,
		sourceExt: string,
		atSeconds: number,
	): Promise<Buffer> {
		return this.withTempDir(async (dir) => {
			const inputPath = join(dir, `src.${sourceExt}`);
			await writeFile(inputPath, input);
			const framePath = join(dir, "frame.png");
			await this.runFfmpeg(inputPath, (cmd) =>
				cmd.seekInput(atSeconds).frames(1).output(framePath),
			);
			return sharp(framePath)
				.resize(640, 360, { fit: "cover" })
				.webp({ quality: 80 })
				.toBuffer();
		});
	}

	encodeAudioAac(input: Buffer, sourceExt: string): Promise<Buffer> {
		return this.withTempDir(async (dir) => {
			const inputPath = join(dir, `src.${sourceExt}`);
			await writeFile(inputPath, input);
			const outPath = join(dir, "primary.m4a");
			await this.runFfmpeg(inputPath, (cmd) =>
				cmd
					.noVideo()
					.audioCodec("aac")
					.audioBitrate("128k")
					.audioFilters("loudnorm=I=-16:TP=-1.5:LRA=11")
					.output(outPath),
			);
			return readFile(outPath);
		});
	}

	async rasterizePdfToWebp(pdf: Buffer): Promise<Buffer[]> {
		// pdf-to-img is ESM-only; dynamic import keeps the CJS build happy.
		const { pdf: toImages } = await import("pdf-to-img");
		const document = await toImages(pdf, { scale: 2 });
		const pages: Buffer[] = [];
		for await (const png of document) {
			pages.push(await sharp(png).webp({ quality: 82 }).toBuffer());
		}
		return pages;
	}

	convertSrtToVtt(srt: Buffer): Promise<Buffer> {
		// Pure conversion (no ffmpeg subtitle quirks): strip sequence numbers and
		// swap the comma decimal separator in timestamps for a dot.
		const normalised = srt.toString("utf8").replace(/\r+/g, "");
		const body = normalised
			.replace(/^\d+\n/gm, "")
			.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
			.trim();
		if (!CAPTION_CUE_TIMING.test(body)) {
			throw new Error(
				"Invalid caption format: expected at least one cue timing",
			);
		}
		return Promise.resolve(Buffer.from(`WEBVTT\n\n${body}\n`, "utf8"));
	}
}
