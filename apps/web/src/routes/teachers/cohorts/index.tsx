import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	BookOpen,
	CalendarDays,
	Compass,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CommercialBadge } from "@/components/catalog/commercial-badge";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, getPublishedCohorts } from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers/cohorts/")({
	component: CohortsCatalogPage,
});

function startLabel(iso: string | null): string | null {
	if (!iso) return null;
	return new Date(iso).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function CohortsCatalogPage() {
	const { t } = useTranslation(["academy", "authoring", "dashboard"]);
	const [query, setQuery] = useState("");

	const { data: cohorts, isPending } = useQuery({
		queryKey: ["published-cohorts"],
		queryFn: getPublishedCohorts,
		staleTime: 0,
		refetchOnMount: "always",
	});

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (cohorts ?? []).filter(
			(c) =>
				q === "" ||
				c.title.toLowerCase().includes(q) ||
				(c.description ?? "").toLowerCase().includes(q),
		);
	}, [cohorts, query]);

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
				</div>

				{isPending ? (
					<div className="mt-6 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
						{["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-48 rounded-card" />
						))}
					</div>
				) : filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<span className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
							<Compass className="size-7" />
						</span>
						<h2 className="mt-4 font-display text-slate-900 text-xl">
							{t("catalog.empty_title")}
						</h2>
						<p className="mt-1 text-slate-500">
							{cohorts && cohorts.length > 0
								? t("catalog.empty_body")
								: t("cohorts.empty", {
										ns: "authoring",
										defaultValue: "No open cohorts right now.",
									})}
						</p>
						{query ? (
							<button
								type="button"
								onClick={() => setQuery("")}
								className={cn(
									buttonVariants({ variant: "outline", size: "sm" }),
									"mt-4",
								)}
							>
								{t("catalog.clear")}
							</button>
						) : null}
					</div>
				) : (
					<>
						<p className="mt-4 text-slate-500 text-sm">
							{t("cohorts.results", { count: filtered.length })}
						</p>
						<Reveal className="mt-4 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
							{filtered.map((cohort) => (
								<Link
									key={cohort.id}
									to="/teachers/cohorts/$slug"
									params={{ slug: cohort.slug }}
									className="group flex flex-col rounded-card border border-slate-200 bg-white p-5 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
								>
									<div className="flex items-start justify-between gap-2">
										<span className="flex size-11 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
											<CalendarDays className="size-5" />
										</span>
										<CommercialBadge
											isFree={cohort.isFree}
											isEarnBackEligible={cohort.isEarnBackEligible}
											earnBackPercentage={cohort.earnBackPercentage}
										/>
									</div>
									<h3 className="mt-3 line-clamp-2 font-display text-slate-900">
										{cohort.title}
									</h3>
									{cohort.description ? (
										<p className="mt-1 line-clamp-2 text-slate-500 text-sm">
											{cohort.description}
										</p>
									) : null}
									<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-xs">
										{startLabel(cohort.startsAt) ? (
											<span className="flex items-center gap-1">
												<CalendarDays className="size-3.5" />
												{startLabel(cohort.startsAt)}
											</span>
										) : null}
										<span className="flex items-center gap-1">
											<BookOpen className="size-3.5" />
											{cohort._count.courses}
										</span>
										{cohort.capacity ? (
											<span className="flex items-center gap-1">
												<Users className="size-3.5" />
												{cohort.seatsFilled}/{cohort.capacity}
											</span>
										) : null}
									</div>
									<div className="mt-auto flex items-center justify-between pt-3">
										<span className="font-stats font-bold text-slate-900 text-sm">
											{cohort.isFree
												? t("catalog.free")
												: formatMoney(cohort.currency, cohort.price ?? 0)}
										</span>
										<span className="flex items-center gap-1 font-semibold text-brand-primary text-sm transition-all group-hover:gap-1.5">
											{t("home.view_course", { ns: "dashboard" })}
											<ArrowRight className="size-4" />
										</span>
									</div>
								</Link>
							))}
						</Reveal>
					</>
				)}
			</div>
		</PublicShell>
	);
}
