import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type ContentLang, translateTexts } from "@/lib/content-api";

export type ReadingLang = "original" | ContentLang;

/**
 * Read-only translation layer (§11). Pass every display string; pick a language
 * and `tr(text)` returns its translation (cached server-side). Grading is never
 * affected — callers keep submitting the original values.
 */
export function useReadingTranslation(texts: string[]) {
	const [lang, setLang] = useState<ReadingLang>("original");
	const uniq = useMemo(
		() => [...new Set(texts.filter((t) => t && t.trim().length > 0))],
		[texts],
	);

	const { data, isFetching } = useQuery({
		queryKey: ["reading-translate", lang, uniq],
		queryFn: () => translateTexts(uniq, lang as ContentLang),
		enabled: lang !== "original" && uniq.length > 0,
		staleTime: Number.POSITIVE_INFINITY,
	});

	const map = useMemo(() => {
		if (lang === "original" || !data) return null;
		const m = new Map<string, string>();
		uniq.forEach((t, i) => {
			m.set(t, data[i] ?? t);
		});
		return m;
	}, [lang, data, uniq]);

	const tr = (text: string) => map?.get(text) ?? text;
	return { lang, setLang, tr, loading: lang !== "original" && isFetching };
}
