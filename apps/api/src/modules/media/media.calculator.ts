/**
 * Pure media-pipeline math (§6.4 "pure calculators" — no Prisma, no I/O).
 */

/** Representative frame ~5s in, matching the encoder port's documented intent. */
export const THUMBNAIL_TARGET_SECONDS = 5;

/**
 * Picks a safe thumbnail seek point. A fixed 5s seek is past the end of any
 * video that short or shorter — ffmpeg can't grab a frame beyond the
 * source's own duration, so encoding used to fail at the thumbnail step for
 * any lesson video ≤5s (a real bug, found via Playwright e2e testing against
 * a real ffmpeg pipeline). Below the target, seek to the midpoint instead
 * (always safely inside the video); at or above it, keep the original ~5s
 * framing. `durationSec` is probed and rounded to a whole second at upload
 * time (media.service.ts's `probeDurationSeconds`), so a video reported as
 * exactly 5s could really be a hair under — the `+1` margin covers that.
 */
export function thumbnailSeekSeconds(durationSec: number): number {
	if (durationSec >= THUMBNAIL_TARGET_SECONDS + 1) {
		return THUMBNAIL_TARGET_SECONDS;
	}
	return Math.max(0, durationSec / 2);
}
