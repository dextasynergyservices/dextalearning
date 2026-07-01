/**
 * Helpers for the Tiptap-authored rich text used by course/path descriptions
 * and outcome statements. Detail views render the HTML; cards, search and meta
 * need a plain-text projection. Old plain-text values pass through untouched.
 */

/** Strip HTML to readable plain text (for previews, search, truncation). */
export function htmlToText(html: string | null | undefined): string {
	if (!html) return "";
	return html
		.replace(/<br\s*\/?>/gi, " ")
		.replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, " ")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&#39;/gi, "'")
		.replace(/&quot;/gi, '"')
		.replace(/\s+/g, " ")
		.trim();
}

/** True when the HTML has no visible text (e.g. Tiptap's empty `<p></p>`). */
export function isBlankHtml(html: string | null | undefined): boolean {
	return htmlToText(html).length === 0;
}
