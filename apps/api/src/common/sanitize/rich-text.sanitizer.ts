import { Transform } from "class-transformer";
import sanitizeHtml from "sanitize-html";

/**
 * Tags Tiptap can produce, and nothing else. Anything outside this list is
 * stripped — including `<script>`, `<style>`, `<iframe>`, `<object>` and any
 * event-handler attribute (`onerror`, `onclick`, …), which is how stored XSS
 * would otherwise reach a learner's browser.
 */
const ALLOWED_TAGS = [
	"p",
	"br",
	"hr",
	"strong",
	"b",
	"em",
	"i",
	"u",
	"s",
	"strike",
	"del",
	"mark",
	"sub",
	"sup",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"ul",
	"ol",
	"li",
	"blockquote",
	"code",
	"pre",
	"a",
	"img",
	"span",
	"div",
	"table",
	"thead",
	"tbody",
	"tr",
	"th",
	"td",
];

/**
 * Server-side sanitiser for instructor/admin rich text (§5 security).
 *
 * The authoring UI is Tiptap, but the API must never trust what arrives — a
 * request can be crafted by hand, and instructor sign-up is self-service, so
 * "the author is trusted" is not a safe assumption. Everything that is later
 * rendered with `dangerouslySetInnerHTML` is sanitised HERE, on the way in, so
 * a malicious payload is never stored in the first place.
 *
 * Links are restricted to http/https/mailto (blocking `javascript:` URLs) and
 * every link opens in a new tab with `rel="noopener noreferrer"`.
 */
export function sanitizeRichText(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: {
			a: ["href", "title", "target", "rel"],
			img: ["src", "alt", "title", "width", "height"],
			// Tiptap marks alignment/classes on blocks; keep class but nothing that
			// can execute (no style — it enables CSS-based exfiltration tricks).
			"*": ["class"],
		},
		allowedSchemes: ["http", "https", "mailto"],
		allowedSchemesByTag: { img: ["http", "https", "data"] },
		// A data: image is inert, but only for images — never for links/iframes.
		allowProtocolRelative: false,
		disallowedTagsMode: "discard",
		transformTags: {
			a: sanitizeHtml.simpleTransform("a", {
				target: "_blank",
				rel: "noopener noreferrer",
			}),
		},
	});
}

/**
 * DTO decorator: sanitises a rich-text field as it is validated, so every
 * write path is covered by construction rather than by remembering to call the
 * sanitiser in each service.
 */
export function SanitizeRichText(): PropertyDecorator {
	return Transform(({ value }) =>
		typeof value === "string" ? sanitizeRichText(value) : value,
	);
}
