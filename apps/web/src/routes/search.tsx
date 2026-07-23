import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FilterChips } from "@/components/catalog/filter-chips";
import {
	PublicCohortCard,
	PublicCourseCard,
	PublicPathCard,
} from "@/components/catalog/public-cards";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import {
	getPublishedCohorts,
	getPublishedCourses,
	getPublishedPaths,
} from "@/lib/content-api";
import { htmlToText } from "@/lib/rich-text";

const SEARCH_TYPES = ["all", "courses", "paths", "cohorts"] as const;

export const Route = createFileRoute("/search")({
	validateSearch: (search: Record<string, unknown>): { q?: string } => ({
		q: typeof search.q === "string" ? search.q : undefined,
	}),
	component: SearchPage,
});

function matches(
	haystack: (string | null | undefined)[],
	query: string,
): boolean {
	return haystack.some((text) => (text ?? "").toLowerCase().includes(query));
}

function SearchPage() {
	const { q } = Route.useSearch();
	const { t } = useTranslation(["academy", "authoring", "dashboard"]);
	const [query, setQuery] = useState(q ?? "");
	const [type, setType] = useState<string>("all");

	const coursesQ = useQuery({
		queryKey: ["published-courses"],
		queryFn: () => getPublishedCourses(),
	});
	const pathsQ = useQuery({
		queryKey: ["published-paths"],
		queryFn: () => getPublishedPaths(),
	});
	const cohortsQ = useQuery({
		queryKey: ["published-cohorts"],
		queryFn: () => getPublishedCohorts(),
	});

	const normalized = query.trim().toLowerCase();
	const active = normalized.length > 0;
	const loading =
		active && (coursesQ.isPending || pathsQ.isPending || cohortsQ.isPending);

	const { courses, paths, cohorts, total } = useMemo(() => {
		if (!active) return { courses: [], paths: [], cohorts: [], total: 0 };
		const courseHits =
			type === "all" || type === "courses"
				? (coursesQ.data ?? []).filter((c) =>
						matches([c.title, htmlToText(c.description)], normalized),
					)
				: [];
		const pathHits =
			type === "all" || type === "paths"
				? (pathsQ.data ?? []).filter((p) =>
						matches(
							[
								p.title,
								htmlToText(p.description),
								htmlToText(p.outcomeStatement),
							],
							normalized,
						),
					)
				: [];
		const cohortHits =
			type === "all" || type === "cohorts"
				? (cohortsQ.data ?? []).filter((c) =>
						matches([c.title, c.description], normalized),
					)
				: [];
		return {
			courses: courseHits,
			paths: pathHits,
			cohorts: cohortHits,
			total: courseHits.length + pathHits.length + cohortHits.length,
		};
	}, [active, normalized, type, coursesQ.data, pathsQ.data, cohortsQ.data]);

	return (
		<PublicShell mobileTitle={t("search.title")}>
			<div className="mx-auto max-w-7xl px-4 lg:px-8">
				<div className="hidden pt-28 lg:block">
					<h1 className="font-display text-4xl tracking-tight text-foreground">
						{t("search.title")}
					</h1>
				</div>

				<div className="-mx-4 sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-border border-b bg-card/90 px-4 py-3 backdrop-blur-md lg:static lg:mx-0 lg:mt-6 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
					<SearchField
						value={query}
						onChange={setQuery}
						placeholder={t("search.placeholder")}
					/>
					<div className="mt-3">
						<FilterChips
							items={SEARCH_TYPES}
							active={type}
							onChange={setType}
							labelPrefix="search.type"
						/>
					</div>
				</div>

				{!active ? (
					<EmptyState
						variant="bare"
						className="py-20"
						icon={Search}
						title={t("search.start_title")}
						description={t("search.start_body")}
					/>
				) : loading ? (
					<div className="mt-6 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
						{["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-48 rounded-card" />
						))}
					</div>
				) : total === 0 ? (
					<EmptyState
						variant="bare"
						className="py-20"
						icon={Search}
						title={t("search.empty_title")}
						description={t("search.empty_body")}
					/>
				) : (
					<div className="pb-10">
						<p className="mt-4 text-muted-foreground text-sm">
							{t("search.results", { count: total })}
						</p>

						{courses.length > 0 ? (
							<section className="mt-6">
								<h2 className="font-display text-lg text-foreground">
									{t("search.section_courses")}
								</h2>
								<Reveal className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
									{courses.map((course) => (
										<PublicCourseCard key={course.id} course={course} />
									))}
								</Reveal>
							</section>
						) : null}

						{paths.length > 0 ? (
							<section className="mt-8">
								<h2 className="font-display text-lg text-foreground">
									{t("search.section_paths")}
								</h2>
								<Reveal className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
									{paths.map((path) => (
										<PublicPathCard key={path.id} path={path} />
									))}
								</Reveal>
							</section>
						) : null}

						{cohorts.length > 0 ? (
							<section className="mt-8">
								<h2 className="font-display text-lg text-foreground">
									{t("search.section_cohorts")}
								</h2>
								<Reveal className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
									{cohorts.map((cohort) => (
										<PublicCohortCard key={cohort.id} cohort={cohort} />
									))}
								</Reveal>
							</section>
						) : null}
					</div>
				)}
			</div>
		</PublicShell>
	);
}
