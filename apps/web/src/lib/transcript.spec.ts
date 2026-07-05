import { describe, expect, it } from "vitest";
import { activeCueIndex, cuesToText, parseTimedTranscript } from "./transcript";

describe("parseTimedTranscript", () => {
	it("returns [] for empty input", () => {
		expect(parseTimedTranscript("")).toEqual([]);
		expect(parseTimedTranscript("   ")).toEqual([]);
	});

	it("parses a WebVTT document, stripping the header and inline tags", () => {
		const vtt = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello <b>world</b>.

00:00:04.500 --> 00:00:06.000
Second cue.`;
		const cues = parseTimedTranscript(vtt);
		expect(cues).toEqual([
			{ start: 1, end: 4, text: "Hello world." },
			{ start: 4.5, end: 6, text: "Second cue." },
		]);
	});

	it("parses an SRT document with numeric indices and comma decimals", () => {
		const srt = `1
00:00:01,000 --> 00:00:03,500
First line.

2
00:00:03,500 --> 00:00:05,000
Second line.`;
		const cues = parseTimedTranscript(srt);
		expect(cues).toEqual([
			{ start: 1, end: 3.5, text: "First line." },
			{ start: 3.5, end: 5, text: "Second line." },
		]);
	});

	it("supports MM:SS.mmm timestamps without an hour component", () => {
		const vtt = `00:01.000 --> 00:02.500\nShort form.`;
		const cues = parseTimedTranscript(vtt);
		expect(cues).toEqual([{ start: 1, end: 2.5, text: "Short form." }]);
	});

	it("skips blocks with no timestamp arrow or no body text", () => {
		const input = `WEBVTT

Not a cue block, no arrow.

00:00:01.000 --> 00:00:02.000

00:00:03.000 --> 00:00:04.000
Real cue.`;
		const cues = parseTimedTranscript(input);
		expect(cues).toEqual([{ start: 3, end: 4, text: "Real cue." }]);
	});

	it("skips a block whose timestamp line doesn't match the arrow format", () => {
		const input = `00:00:05.000 --> garbage\nCue text.`;
		expect(parseTimedTranscript(input)).toEqual([]);
	});

	it("sorts cues by start time even if the source is out of order", () => {
		const input = `00:00:10.000 --> 00:00:11.000
Later.

00:00:01.000 --> 00:00:02.000
Earlier.`;
		const cues = parseTimedTranscript(input);
		expect(cues.map((c) => c.text)).toEqual(["Earlier.", "Later."]);
	});
});

describe("cuesToText", () => {
	it("joins cue text with newlines", () => {
		const text = cuesToText([
			{ start: 0, end: 1, text: "One" },
			{ start: 1, end: 2, text: "Two" },
		]);
		expect(text).toBe("One\nTwo");
	});

	it("is empty for no cues", () => {
		expect(cuesToText([])).toBe("");
	});
});

describe("activeCueIndex", () => {
	const cues = [
		{ start: 0, end: 2, text: "a" },
		{ start: 2, end: 5, text: "b" },
		{ start: 5, end: 8, text: "c" },
	];

	it("is -1 before the first cue starts", () => {
		expect(activeCueIndex(cues, -1)).toBe(-1);
	});

	it("picks the last cue whose start has passed", () => {
		expect(activeCueIndex(cues, 3)).toBe(1);
	});

	it("stays on the last cue through a gap/pause after it ends", () => {
		expect(activeCueIndex(cues, 100)).toBe(2);
	});

	it("is -1 for an empty cue list", () => {
		expect(activeCueIndex([], 5)).toBe(-1);
	});
});
