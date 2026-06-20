import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock3, Compass, Layers3, Waypoints } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CommercialBadge } from "@/components/catalog/commercial-badge";
import { FilterChips } from "@/components/catalog/filter-chips";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, getPublishedPaths } from "@/lib/content-api";
import { cn } from "@/lib/utils";

const PATH_LEVELS = [
	"all",
	"beginner",
	"intermediate",
	"advanced",
	"mixed",
] as const;

export const Route = createFileRoute("/teachers/paths/")({
	component: PathsCatalogPage,
});

function PathsCatalogPage() {
	const { t } = useTranslation(["academy", "authoring"]);
	const [query, setQuery] = useState("");
	const [level, setLevel] = useState<string>("all");

	const { data: paths, isPending } = useQuery({
		queryKey: ["published-paths"],
		queryFn: getPublishedPaths,
		staleTime: 0,
		refetchOnMount: "always",
	});

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (paths ?? []).filter((path) => {
			const matchesLevel = level === "all" || path.level === level;
			const matchesQuery =
				q === "" ||
				path.title.toLowerCase().includes(q) ||
				(path.description ?? "").toLowerCase().includes(q);
			return matchesLevel && matchesQuery;
		});
	}, [paths, query, level]);

	const reset = () => {
		setQuery("");
		setLevel("all");
	};

	return (
		<PublicShell mobileTitle={t("paths.title")}>
			<div className="mx-auto max-w-7xl px-4 lg:px-8">
				<div className="hidden pt-28 lg:block">
					<h1 className="font-display text-4xl tracking-tight text-slate-900">
						{t("paths.title")}
					</h1>
					<p className="mt-2 text-lg text-slate-500">{t("paths.subtitle")}</p>
				</div>

				<div className="-mx-4 sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-slate-100 border-b bg-white/90 px-4 py-3 backdrop-blur-md lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
					<SearchField
						value={query}
						onChange={setQuery}
						placeholder={t("paths.search_placeholder")}
					/>
					<div className="mt-3">
						<FilterChips
							items={PATH_LEVELS}
							active={level}
							onChange={setLevel}
							labelPrefix="level"
						/>
					</div>
				</div>

				{isPending ? (
					<div className="mt-6 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
						{["a", "b", "c"].map((k) => (
							<Skeleton key={k} className="h-56 rounded-card" />
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
							{paths && paths.length > 0
								? t("catalog.empty_body")
								: t("paths.empty", {
										ns: "authoring",
										defaultValue: "No paths published yet.",
									})}
						</p>
						{query || level !== "all" ? (
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
						) : null}
					</div>
				) : (
					<>
						<p className="mt-4 text-slate-500 text-sm">
							{t("paths.results", { count: filtered.length })}
						</p>
						<Reveal className="mt-4 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
							{filtered.map((path) => (
								<Link
									key={path.id}
									to="/teachers/paths/$slug"
									params={{ slug: path.slug }}
									className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
								>
									<div className="relative aspect-[16/8] overflow-hidden bg-slate-100">
										{path.thumbnailUrl ? (
											<img
												src={path.thumbnailUrl}
												alt=""
												className="size-full object-cover transition-transform group-hover:scale-[1.03]"
											/>
										) : (
											<span className="flex size-full items-center justify-center text-brand-primary/40">
												<Waypoints className="size-10" />
											</span>
										)}
										<CommercialBadge
											isFree={path.isFree}
											isEarnBackEligible={path.isEarnBackEligible}
											earnBackPercentage={path.earnBackPercentage}
											className="absolute top-2 right-2 shadow-sm"
										/>
									</div>
									<div className="flex flex-1 flex-col p-4">
										<h3 className="line-clamp-2 font-display text-slate-900">
											{path.title}
										</h3>
										{path.outcomeStatement || path.description ? (
											<p className="mt-1 line-clamp-2 text-slate-500 text-sm">
												{path.outcomeStatement || path.description}
											</p>
										) : null}
										<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-xs">
											<span className="flex items-center gap-1">
												<Layers3 className="size-3.5" />
												{t("paths.courses_count", {
													ns: "authoring",
													defaultValue: "{{count}} courses",
													count: path._count.pathCourses,
												})}
											</span>
											{path.estimatedHours ? (
												<span className="flex items-center gap-1">
													<Clock3 className="size-3.5" />
													{t("paths.hours", {
														ns: "authoring",
														defaultValue: "{{count}}h",
														count: path.estimatedHours,
													})}
												</span>
											) : null}
										</div>
										<div className="mt-auto flex items-center justify-between pt-3">
											<span className="font-stats font-bold text-slate-900 text-sm">
												{path.isFree
													? t("catalog.free")
													: formatMoney(path.currency, path.price ?? 0)}
											</span>
											<span className="flex items-center gap-1 font-semibold text-brand-primary text-sm transition-all group-hover:gap-1.5">
												{t("home.view_course", { ns: "dashboard" })}
												<ArrowRight className="size-4" />
											</span>
										</div>
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
