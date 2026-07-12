import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Search, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type ContentSearchResult, searchKeys } from "@/lib/search-api";

/**
 * Semantic search over a course/path/cohort's transcripts (§4.10 RAG). Type a
 * question or keywords and jump straight to the lesson that covers it — meaning-
 * based, not literal. Scope-agnostic: the caller supplies the fetcher, so the
 * same component serves course, path and cohort hubs. Native-feeling inline.
 */
export function ContentSearch({
	scopeId,
	fetcher,
}: {
	scopeId: string;
	fetcher: (q: string) => Promise<ContentSearchResult[]>;
}) {
	const { t } = useTranslation("ai");
	const [input, setInput] = useState("");
	const [query, setQuery] = useState("");

	// Debounce so we embed once the learner pauses, not on every keystroke.
	useEffect(() => {
		const id = setTimeout(() => setQuery(input.trim()), 350);
		return () => clearTimeout(id);
	}, [input]);

	const enabled = query.length >= 2;
	const { data, isFetching } = useQuery({
		queryKey: searchKeys.scope(scopeId, query),
		queryFn: () => fetcher(query),
		enabled,
		staleTime: 60 * 1000,
	});

	const showPanel = input.trim().length >= 2;

	return (
		<section className="rounded-card border border-border bg-card shadow-card">
			<div className="flex items-center gap-2 px-4 py-3">
				<Sparkles className="size-4 shrink-0 text-brand-primary" />
				<div className="relative flex-1">
					<Search className="-translate-y-1/2 absolute top-1/2 left-0 size-4 text-muted-foreground" />
					<input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder={t("search.placeholder", {
							defaultValue: "Search this course by meaning…",
						})}
						aria-label={t("search.label", {
							defaultValue: "Search course content",
						})}
						className="w-full bg-transparent py-1 pr-6 pl-6 text-foreground text-sm outline-none placeholder:text-muted-foreground"
					/>
					{input ? (
						<button
							type="button"
							onClick={() => setInput("")}
							aria-label={t("search.clear", { defaultValue: "Clear" })}
							className="-translate-y-1/2 absolute top-1/2 right-0 text-muted-foreground hover:text-foreground"
						>
							<X className="size-4" />
						</button>
					) : null}
				</div>
				{isFetching ? (
					<Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
				) : null}
			</div>

			{showPanel ? (
				<div
					// Announce result counts / states to screen readers as they change.
					aria-live="polite"
					className="border-border border-t px-2 py-2"
				>
					{!enabled ? null : isFetching && !data ? (
						<p className="px-2 py-3 text-muted-foreground text-sm">
							{t("search.searching", { defaultValue: "Searching…" })}
						</p>
					) : data && data.length > 0 ? (
						<ul className="space-y-1">
							{data.map((r) => (
								<li key={r.lessonId}>
									<Link
										to="/learn/lesson/$lessonId"
										params={{ lessonId: r.lessonId }}
										className="block rounded-btn px-2 py-2 transition-colors hover:bg-accent"
									>
										<span className="block font-medium text-foreground text-sm">
											{r.lessonTitle}
										</span>
										<span className="mt-0.5 line-clamp-2 block text-muted-foreground text-xs">
											{r.snippet}
										</span>
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p className="px-2 py-3 text-muted-foreground text-sm">
							{t("search.no_results", {
								defaultValue: "No lessons match that yet.",
							})}
						</p>
					)}
				</div>
			) : null}
		</section>
	);
}
