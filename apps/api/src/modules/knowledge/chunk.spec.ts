import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
	it("returns nothing for empty/whitespace input", () => {
		expect(chunkText("")).toEqual([]);
		expect(chunkText("   \n\t ")).toEqual([]);
	});

	it("keeps short text as a single chunk", () => {
		expect(chunkText("A short lesson about arrays.")).toEqual([
			"A short lesson about arrays.",
		]);
	});

	it("packs sentences up to maxChars and splits when they'd overflow", () => {
		const chunks = chunkText("aaaa. bbbb. cccc.", { maxChars: 10 });
		// "aaaa. bbbb." is 11 > 10, so each ~5-char sentence packs separately.
		expect(chunks.length).toBeGreaterThan(1);
		for (const c of chunks) expect(c.length).toBeLessThanOrEqual(10);
		expect(chunks.join(" ")).toContain("aaaa");
		expect(chunks.join(" ")).toContain("cccc");
	});

	it("hard-splits a single unit longer than maxChars", () => {
		const long = "x".repeat(25);
		const chunks = chunkText(long, { maxChars: 10 });
		expect(chunks).toEqual(["xxxxxxxxxx", "xxxxxxxxxx", "xxxxx"]);
	});

	it("splits on newlines too", () => {
		const chunks = chunkText("line one\nline two\nline three", {
			maxChars: 12,
		});
		expect(chunks.length).toBeGreaterThan(1);
	});

	it("caps the number of chunks", () => {
		const many = Array.from({ length: 200 }, (_, i) => `s${i}.`).join(" ");
		const chunks = chunkText(many, { maxChars: 4, maxChunks: 10 });
		expect(chunks.length).toBeLessThanOrEqual(10);
	});
});
