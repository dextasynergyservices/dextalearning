import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CohortCard } from "@/components/catalog/cohort-card";
import { CourseCard } from "@/components/catalog/course-card";
import { FilterChips } from "@/components/catalog/filter-chips";
import { PathCard } from "@/components/catalog/path-card";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { SearchField } from "@/components/ui/search-field";
import {
	SAMPLE_COHORTS,
	SAMPLE_COURSES,
	SAMPLE_PATHS,
} from "@/lib/sample-data";

const SEARCH_TYPES = ["all", "courses", "paths", "cohorts"] as const;

export const Route = createFileRoute("/search")({
	validateSearch: (search: Record<string, unknown>): { q?: string } => ({
		q: typeof search.q === "string" ? search.q : undefined,
	}),
	component: SearchPage,
});

function matches(haystack: string[], query: string): boolean {
	return haystack.some((text) => text.toLowerCase().includes(query));
}

function SearchPage() {
	const { q } = Route.useSearch();
	const { t } = useTranslation("academy");
	const [query, setQuery] = useState(q ?? "");
	const [type, setType] = useState<string>("all");

	const normalized = query.trim().toLowerCase();
	const active = normalized.length > 0;

	const { courses, paths, cohorts, total } = useMemo(() => {
		if (!active) {
			return { courses: [], paths: [], cohorts: [], total: 0 };
		}
		const courseHits =
			type === "all" || type === "courses"
				? SAMPLE_COURSES.filter((c) =>
						matches([c.title, c.summary, c.instructorName], normalized),
					)
				: [];
		const pathHits =
			type === "all" || type === "paths"
				? SAMPLE_PATHS.filter((p) => matches([p.title, p.summary], normalized))
				: [];
		const cohortHits =
			type === "all" || type === "cohorts"
				? SAMPLE_COHORTS.filter((c) =>
						matches([c.title, c.summary, c.facilitatorName], normalized),
					)
				: [];
		return {
			courses: courseHits,
			paths: pathHits,
			cohorts: cohortHits,
			total: courseHits.length + pathHits.length + cohortHits.length,
		};
	}, [active, normalized, type]);

	return (
		<PublicShell mobileTitle={t("search.title")}>
			<div className="mx-auto max-w-7xl px-4 lg:px-8">
				<div className="hidden pt-28 lg:block">
					<h1 className="font-display text-4xl tracking-tight text-slate-900">
						{t("search.title")}
					</h1>
				</div>

				<div className="-mx-4 sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-slate-100 border-b bg-white/90 px-4 py-3 backdrop-blur-md lg:static lg:mx-0 lg:mt-6 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
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
					<div className="flex flex-col items-center justify-center py-24 text-center">
						<span className="flex size-14 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary">
							<Search className="size-7" />
						</span>
						<h2 className="mt-4 font-display text-slate-900 text-xl">
							{t("search.start_title")}
						</h2>
						<p className="mt-1 max-w-sm text-slate-500">
							{t("search.start_body")}
						</p>
					</div>
				) : total === 0 ? (
					<div className="flex flex-col items-center justify-center py-24 text-center">
						<span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
							<Search className="size-7" />
						</span>
						<h2 className="mt-4 font-display text-slate-900 text-xl">
							{t("search.empty_title")}
						</h2>
						<p className="mt-1 text-slate-500">{t("search.empty_body")}</p>
					</div>
				) : (
					<div className="pb-10">
						<p className="mt-4 text-slate-500 text-sm">
							{t("search.results", { count: total })}
						</p>

						{courses.length > 0 ? (
							<section className="mt-6">
								<h2 className="font-display text-lg text-slate-900">
									{t("search.section_courses")}
								</h2>
								<Reveal className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
									{courses.map((course) => (
										<CourseCard key={course.slug} course={course} />
									))}
								</Reveal>
							</section>
						) : null}

						{paths.length > 0 ? (
							<section className="mt-8">
								<h2 className="font-display text-lg text-slate-900">
									{t("search.section_paths")}
								</h2>
								<Reveal className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
									{paths.map((path) => (
										<PathCard key={path.slug} path={path} />
									))}
								</Reveal>
							</section>
						) : null}

						{cohorts.length > 0 ? (
							<section className="mt-8">
								<h2 className="font-display text-lg text-slate-900">
									{t("search.section_cohorts")}
								</h2>
								<Reveal className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
									{cohorts.map((cohort) => (
										<CohortCard key={cohort.slug} cohort={cohort} />
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
