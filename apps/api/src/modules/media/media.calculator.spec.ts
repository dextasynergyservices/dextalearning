import { describe, expect, it } from "vitest";
import { thumbnailSeekSeconds } from "./media.calculator";

describe("thumbnailSeekSeconds", () => {
	it("seeks to the fixed ~5s target for a normal-length video", () => {
		expect(thumbnailSeekSeconds(60)).toBe(5);
		expect(thumbnailSeekSeconds(6)).toBe(5);
	});

	it("seeks to the midpoint for a video shorter than the target", () => {
		expect(thumbnailSeekSeconds(4)).toBe(2);
		expect(thumbnailSeekSeconds(1)).toBe(0.5);
	});

	it("never seeks past a video reported as exactly 5s (rounded duration could really be under)", () => {
		expect(thumbnailSeekSeconds(5)).toBe(2.5);
	});

	it("never returns a negative seek point for a zero-length source", () => {
		expect(thumbnailSeekSeconds(0)).toBe(0);
	});
});
