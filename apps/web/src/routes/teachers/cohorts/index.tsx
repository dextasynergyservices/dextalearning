import { createFileRoute } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CohortCard } from "@/components/catalog/cohort-card";
import { FilterChips } from "@/components/catalog/filter-chips";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { SAMPLE_COHORTS } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

const COHORT_LEVELS = [
	"all",
	"beginner",
	"intermediate",
	"advanced",
	"mixed",
] as const;

export const Route = createFileRoute("/teachers/cohorts/")({
	component: CohortsCatalogPage,
});

function CohortsCatalogPage() {
	const { t } = useTranslation("academy");
	const [query, setQuery] = useState("");
	const [level, setLevel] = useState<string>("all");

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return SAMPLE_COHORTS.filter((cohort) => {
			const matchesLevel = level === "all" || cohort.level === level;
			const matchesQuery =
				q === "" ||
				cohort.title.toLowerCase().includes(q) ||
				cohort.summary.toLowerCase().includes(q);
			return matchesLevel && matchesQuery;
		});
	}, [query, level]);

	const reset = () => {
		setQuery("");
		setLevel("all");
	};

	return (
		<PublicShell mobileTitle={t("cohorts.title")}>
			<div className="mx-auto max-w-7xl px-4 lg:px-8">
				<div className="hidden pt-28 lg:block">
					<h1 className="font-display text-4xl tracking-tight text-slate-900">
						{t("cohorts.title")}
					</h1>
					<p className="mt-2 text-lg text-slate-500">{t("cohorts.subtitle")}</p>
				</div>

				<div className="-mx-4 sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-slate-100 border-b bg-white/90 px-4 py-3 backdrop-blur-md lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
					<SearchField
						value={query}
						onChange={setQuery}
						placeholder={t("cohorts.search_placeholder")}
					/>
					<div className="mt-3">
						<FilterChips
							items={COHORT_LEVELS}
							active={level}
							onChange={setLevel}
							labelPrefix="level"
						/>
					</div>
				</div>

				<p className="mt-4 text-slate-500 text-sm">
					{t("cohorts.results", { count: filtered.length })}
				</p>

				{filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
							<Compass className="size-7" />
						</span>
						<h2 className="mt-4 font-display text-slate-900 text-xl">
							{t("catalog.empty_title")}
						</h2>
						<p className="mt-1 text-slate-500">{t("catalog.empty_body")}</p>
						<button
							type="button"
							onClick={reset}
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								"mt-4",
							)}
						>
							{t("catalog.clear")}
						</button>
					</div>
				) : (
					<Reveal className="mt-4 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
						{filtered.map((cohort) => (
							<CohortCard key={cohort.slug} cohort={cohort} />
						))}
					</Reveal>
				)}
			</div>
		</PublicShell>
	);
}
