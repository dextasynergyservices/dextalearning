import { cn } from "@/lib/utils";

/**
 * Renders trusted instructor/admin HTML authored via Tiptap (course/path
 * descriptions, outcome statements) with `prose` styling. Use `invert` on a
 * permanently dark surface (heroes); otherwise it adapts to the theme. For
 * cards/search use `htmlToText` instead of this.
 */
export function RichText({
	html,
	className,
	invert,
}: {
	html: string;
	className?: string;
	invert?: boolean;
}) {
	return (
		<div
			className={cn(
				"prose max-w-none",
				invert ? "prose-invert" : "prose-slate dark:prose-invert",
				className,
			)}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: instructor rich-text authored via Tiptap, same trust model as the lesson body.
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
