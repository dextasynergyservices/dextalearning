import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Compass } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogVisual } from "@/components/catalog/catalog-visual";
import { CommercialBadge } from "@/components/catalog/commercial-badge";
import { PublicShell } from "@/components/layout/public-shell";
import { Reveal } from "@/components/marketing/reveal";
import { buttonVariants } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, getPublishedCourses } from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers/courses/")({
	component: CoursesCatalogPage,
});

function CoursesCatalogPage() {
	const { t } = useTranslation(["academy", "authoring"]);
	const [query, setQuery] = useState("");

	const { data: courses, isPending } = useQuery({
		queryKey: ["published-courses"],
		queryFn: getPublishedCourses,
		staleTime: 0,
		refetchOnMount: "always",
	});

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (courses ?? []).filter(
			(course) =>
				q === "" ||
				course.title.toLowerCase().includes(q) ||
				(course.description ?? "").toLowerCase().includes(q),
		);
	}, [courses, query]);

	return (
		<PublicShell mobileTitle={t("catalog.title")}>
			<div className="mx-auto max-w-7xl px-4 lg:px-8">
				<div className="hidden pt-28 lg:block">
					<h1 className="font-display text-4xl tracking-tight text-slate-900">
						{t("catalog.title")}
					</h1>
					<p className="mt-2 text-lg text-slate-500">{t("catalog.subtitle")}</p>
				</div>

				<div className="-mx-4 sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-slate-100 border-b bg-white/90 px-4 py-3 backdrop-blur-md lg:static lg:mx-0 lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
					<SearchField
						value={query}
						onChange={setQuery}
						placeholder={t("catalog.search_placeholder")}
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
							{courses && courses.length > 0
								? t("catalog.empty_body")
								: t("home.empty_courses", { ns: "dashboard" })}
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
							{t("catalog.results", { count: filtered.length })}
						</p>
						<Reveal className="mt-4 grid gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
							{filtered.map((course) => (
								<Link
									key={course.id}
									to="/courses/$slug"
									params={{ slug: course.slug }}
									className="group flex flex-col overflow-hidden rounded-card border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover"
								>
									<div className="relative aspect-[16/8] overflow-hidden">
										{course.thumbnailUrl ? (
											<img
												src={course.thumbnailUrl}
												alt=""
												className="size-full object-cover transition-transform group-hover:scale-[1.03]"
											/>
										) : (
											<CatalogVisual
												icon={BookOpen}
												label={course.level ?? undefined}
												meta={course.language.toUpperCase()}
												className="size-full"
											/>
										)}
										<CommercialBadge
											isFree={course.isFree}
											isEarnBackEligible={course.isEarnBackEligible}
											earnBackPercentage={course.earnBackPercentage}
											className="absolute top-2 right-2 shadow-sm"
										/>
									</div>
									<div className="flex flex-1 flex-col p-4">
										<h3 className="line-clamp-2 font-display text-slate-900">
											{course.title}
										</h3>
										{course.description ? (
											<p className="mt-1 line-clamp-2 text-slate-500 text-sm">
												{course.description}
											</p>
										) : null}
										<span className="mt-1.5 text-slate-400 text-xs">
											{t("courses.modules", {
												ns: "authoring",
												count: course._count.modules,
											})}
										</span>
										<div className="mt-auto flex items-center justify-between pt-3">
											<span className="font-stats font-bold text-slate-900 text-sm">
												{course.isFree
													? t("catalog.free")
													: formatMoney(course.currency, course.price ?? 0)}
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
