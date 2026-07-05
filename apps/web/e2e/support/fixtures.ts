import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-expect-error — no types package; this is just a string path to the binary.
import ffmpegPath from "ffmpeg-static";

export const testVideoPath = path.join(os.tmpdir(), "dexta-e2e-test-video.mp4");

/**
 * Generates a ~3s synthetic test-pattern clip via the already-installed
 * ffmpeg-static binary (same tool the real encoding pipeline uses) — no
 * binary fixture committed to the repo. Regenerated fresh each run;
 * idempotent to call more than once.
 *
 * Deliberately short (≤5s): media.workers.ts used to hardcode thumbnail
 * extraction to seek to exactly 5s regardless of source length, so any upload
 * this short failed encoding at 90% ("Input file is missing:
 * .../frame.png", ffmpeg can't seek past a source's own end) — a real bug
 * found via this exact test, now fixed in media.calculator.ts's
 * `thumbnailSeekSeconds`. Keeping the fixture at 3s (not lengthening it once
 * fixed) turns this into the actual regression test for that bug, rather
 * than one that dodges the edge case it found.
 */
export function ensureTestVideo(): void {
	if (existsSync(testVideoPath)) return;
	execFileSync(ffmpegPath as unknown as string, [
		"-y",
		"-f",
		"lavfi",
		"-i",
		"testsrc=duration=3:size=320x240:rate=5",
		"-f",
		"lavfi",
		"-i",
		"anullsrc=r=44100:cl=stereo",
		"-t",
		"3",
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		"-c:a",
		"aac",
		"-shortest",
		testVideoPath,
	]);
}
