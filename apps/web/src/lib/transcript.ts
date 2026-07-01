/**
 * Timed-transcript helpers. A timed transcript is a list of `{ start, end, text }`
 * cues (seconds) that drives the in-player highlight. We parse it from a pasted or
 * uploaded VTT/SRT file entirely on the client — no AI, no server round-trip. The
 * caption system is untouched; this feeds the transcript only.
 */
export interface TranscriptCue {
	start: number;
	end: number;
	text: string;
}

const ARROW =
	/(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d{1,2}:\d{2}[.,]\d{1,3})/;

/** "HH:MM:SS.mmm" | "MM:SS.mmm" | SRT's "," variant → seconds. */
function toSeconds(stamp: string): number {
	const m = stamp
		.trim()
		.replace(",", ".")
		.match(/(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d{1,3})?)/);
	if (!m) return Number.NaN;
	const h = m[1] ? Number(m[1]) : 0;
	return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Parse a VTT or SRT document into sorted cues. Tolerant of the WEBVTT header,
 * numeric SRT indices, blank lines and inline tags. Returns [] if nothing parses.
 */
export function parseTimedTranscript(input: string): TranscriptCue[] {
	const text = input.replace(/\r\n?/g, "\n").trim();
	if (!text) return [];
	const cues: TranscriptCue[] = [];
	for (const block of text.split(/\n\s*\n/)) {
		const lines = block.split("\n").map((l) => l.trim());
		const idx = lines.findIndex((l) => ARROW.test(l));
		if (idx === -1) continue;
		const m = lines[idx].match(ARROW);
		if (!m) continue;
		const start = toSeconds(m[1]);
		const end = toSeconds(m[2]);
		const body = lines
			.slice(idx + 1)
			.join(" ")
			.replace(/<[^>]+>/g, "")
			.trim();
		if (!body || Number.isNaN(start)) continue;
		cues.push({ start, end: Number.isNaN(end) ? start : end, text: body });
	}
	return cues.sort((a, b) => a.start - b.start);
}

/** Flatten cues into the plain transcript text (publish gate + AI source). */
export function cuesToText(cues: TranscriptCue[]): string {
	return cues.map((c) => c.text).join("\n");
}

/**
 * Index of the active cue for a playback time (seconds), or -1. The last cue
 * whose start has passed stays active through gaps/pauses (karaoke behaviour).
 */
export function activeCueIndex(cues: TranscriptCue[], seconds: number): number {
	let active = -1;
	for (let i = 0; i < cues.length; i++) {
		if (seconds >= cues[i].start) active = i;
		else break;
	}
	return active;
}
