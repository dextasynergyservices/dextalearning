import { useParams } from "@tanstack/react-router";

/** The default/MVP academy (blueprint §2.4 — Teacher Academy launched first). */
export const DEFAULT_ACADEMY = "teachers";

/**
 * The academy the user is currently browsing — the `/:academy` route param when
 * on an academy page, else the default academy. Lets shared chrome (header,
 * footer, tab bar) keep catalogue links inside the current academy instead of
 * jumping back to a fixed one. `strict: false` so it's safe to call anywhere.
 */
export function useCurrentAcademy(): string {
	return useAcademyParam() ?? DEFAULT_ACADEMY;
}

/**
 * The raw `/:academy` route param — a slug when inside an academy, `undefined`
 * on global pages (homepage, blog, detail). Lets chrome tell "in an academy"
 * from "global" so it can show academy catalogue nav vs. an academies menu.
 */
export function useAcademyParam(): string | undefined {
	const params = useParams({ strict: false }) as { academy?: string };
	return params.academy;
}
