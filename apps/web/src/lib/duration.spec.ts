import { describe, expect, it } from "vitest";
import { contentLengthLabel, contentMinutes, lessonSeconds } from "./duration";

describe("lessonSeconds", () => {
	it("prefers video duration over audio", () => {
		expect(lessonSeconds({ videoDurationSec: 120, audioDurationSec: 60 })).toBe(
			120,
		);
	});

	it("falls back to audio duration when there's no video", () => {
		expect(
			lessonSeconds({ videoDurationSec: null, audioDurationSec: 90 }),
		).toBe(90);
	});

	it("is 0 for text/PDF lessons with no media", () => {
		expect(
			lessonSeconds({ videoDurationSec: null, audioDurationSec: null }),
		).toBe(0);
	});
});

describe("contentMinutes", () => {
	it("is 0 when no lesson carries a media duration", () => {
		const result = contentMinutes([
			{ videoDurationSec: null, audioDurationSec: null },
			{ videoDurationSec: null, audioDurationSec: null },
		]);
		expect(result).toBe(0);
	});

	it("sums lesson durations and rounds up to the nearest minute", () => {
		const result = contentMinutes([
			{ videoDurationSec: 90, audioDurationSec: null }, // 1.5 min
			{ videoDurationSec: null, audioDurationSec: 30 }, // 0.5 min
		]);
		expect(result).toBe(2); // 120s total -> ceil(2) = 2
	});
});

describe("contentLengthLabel", () => {
	// Mimics i18next: pick a template by key and interpolate `opts`.
	const t = (key: string, opts?: Record<string, unknown>): string => {
		if (key === "content.minutes") return `≈ ${opts?.count} min`;
		if (key === "content.hours") return `≈ ${opts?.count}h`;
		if (key === "content.hours_minutes") return `≈ ${opts?.h}h ${opts?.m}m`;
		return "";
	};

	it("is empty when there is no content length", () => {
		expect(contentLengthLabel(t, 0)).toBe("");
	});

	it("labels minutes under an hour", () => {
		expect(contentLengthLabel(t, 35)).toBe("≈ 35 min");
	});

	it("labels whole hours with no leftover minutes", () => {
		expect(contentLengthLabel(t, 120)).toBe("≈ 2h");
	});

	it("labels hours plus minutes", () => {
		expect(contentLengthLabel(t, 135)).toBe("≈ 2h 15m");
	});
});
