import { describe, expect, it } from "vitest";
import { htmlToText, isBlankHtml } from "./rich-text";

describe("htmlToText", () => {
	it("returns an empty string for null/undefined/empty input", () => {
		expect(htmlToText(null)).toBe("");
		expect(htmlToText(undefined)).toBe("");
		expect(htmlToText("")).toBe("");
	});

	it("strips tags and collapses block-level boundaries into spaces", () => {
		expect(htmlToText("<p>Hello</p><p>World</p>")).toBe("Hello World");
	});

	it("converts <br> into a space", () => {
		expect(htmlToText("Line one<br/>Line two")).toBe("Line one Line two");
	});

	it("decodes common HTML entities", () => {
		expect(
			htmlToText("Fish &amp; Chips &lt;3 &quot;great&quot; &#39;food&#39;"),
		).toBe(`Fish & Chips <3 "great" 'food'`);
	});

	it("collapses repeated whitespace and trims the result", () => {
		expect(htmlToText("<p>  Hello   world  </p>")).toBe("Hello world");
	});

	it("passes plain text through untouched (old values)", () => {
		expect(htmlToText("Just plain text")).toBe("Just plain text");
	});
});

describe("isBlankHtml", () => {
	it("is true for null/undefined/empty", () => {
		expect(isBlankHtml(null)).toBe(true);
		expect(isBlankHtml(undefined)).toBe(true);
		expect(isBlankHtml("")).toBe(true);
	});

	it("is true for Tiptap's empty paragraph", () => {
		expect(isBlankHtml("<p></p>")).toBe(true);
	});

	it("is false when there is visible text", () => {
		expect(isBlankHtml("<p>Something</p>")).toBe(false);
	});
});
