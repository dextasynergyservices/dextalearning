import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Clock3, Layers3, Target, Waypoints } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, getPublicPath } from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers/paths/$slug")({
	component: PathDetailPage,
});

function PathDetailPage() {
	const { slug } = Route.useParams();
	const { t } = useTranslation(["academy", "authoring", "dashboard"]);
	const {
		data: path,
		isPending,
		isError,
	} = useQuery({
		queryKey: ["public-path", slug],
		queryFn: () => getPublicPath(slug),
	});

	if (isPending) {
		return (
			<PublicShell mobileTitle={t("paths.title")} mobileShowBack>
				<div className="mx-auto max-w-5xl space-y-4 px-6 py-10 lg:px-8">
					<Skeleton className="h-56 rounded-card" />
					<Skeleton className="h-64 rounded-card" />
				</div>
			</PublicShell>
		);
	}

	if (isError || !path) {
		return (
			<PublicShell mobileTitle={t("paths.not_found_title")} mobileShowBack>
				<section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-24 text-center">
					<h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
						{t("paths.not_found_title")}
					</h1>
					<p className="mt-3 text-slate-500">{t("paths.not_found_body")}</p>
					<Link
						to="/teachers/paths"
						className={cn(
							buttonVariants({ variant: "outline", size: "md" }),
							"mt-6",
						)}
					>
						{t("paths.title")}
					</Link>
				</section>
			</PublicShell>
		);
	}

	const price = path.isFree
		? t("catalog.free")
		: formatMoney(path.currency, path.price ?? 0);
	const earnBadge = path.isEarnBackEligible
		? path.earnBackPercentage && path.earnBackPercentage < 100
			? t("catalog.earnback_pct", { pct: path.earnBackPercentage })
			: t("catalog.earnback")
		: null;

	return (
		<PublicShell mobileTitle={path.title} mobileShowBack hideFooterOnMobile>
			<section className="relative overflow-hidden bg-hero-bg text-white">
				<div className="relative mx-auto max-w-7xl px-6 pt-20 pb-12 lg:px-8 lg:pt-32 lg:pb-16">
					<p className="flex items-center gap-2 font-stats font-semibold text-sm text-white/80 uppercase tracking-wide">
						<Waypoints className="size-4" /> {t("paths.title")}
					</p>
					<h1 className="mt-2 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
						{path.title}
					</h1>
					{path.outcomeStatement || path.description ? (
						<p className="mt-4 max-w-2xl text-white/85">
							{path.outcomeStatement || path.description}
						</p>
					) : null}
					<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
						<span className="inline-flex items-center gap-1">
							<Layers3 className="size-4" />{" "}
							{t("paths.courses_count", {
								ns: "authoring",
								defaultValue: "{{count}} courses",
								count: path.pathCourses.length,
							})}
						</span>
						{path.estimatedHours ? (
							<span className="inline-flex items-center gap-1">
								<Clock3 className="size-4" />{" "}
								{t("paths.hours", {
									ns: "authoring",
									defaultValue: "{{count}}h",
									count: path.estimatedHours,
								})}
							</span>
						) : null}
						{path.level ? (
							<span className="rounded-pill bg-white/15 px-2.5 py-0.5 font-stats text-xs capitalize">
								{path.level}
							</span>
						) : null}
					</div>
				</div>
			</section>

			<div className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-3 lg:gap-10 lg:px-8">
				<div className="pt-10 pb-32 lg:col-span-2 lg:pb-10">
					{path.outcomeStatement ? (
						<div className="flex items-start gap-3 rounded-card border border-brand-primary/15 bg-brand-primary-light/40 p-5">
							<Target className="mt-0.5 size-5 shrink-0 text-brand-primary" />
							<div>
								<h2 className="font-display text-lg text-slate-900">
									{t("paths.outcome", {
										ns: "authoring",
										defaultValue: "Outcome",
									})}
								</h2>
								<p className="mt-1 text-slate-600 text-sm">
									{path.outcomeStatement}
								</p>
							</div>
						</div>
					) : null}

					<h2 className="mt-10 font-display text-2xl text-slate-900">
						{t("paths.courses_title", {
							ns: "authoring",
							defaultValue: "Courses in this path",
						})}
					</h2>
					<div className="mt-4 space-y-3">
						{path.pathCourses.map((pc, index) => (
							<Link
								key={pc.course.id}
								to="/courses/$slug"
								params={{ slug: pc.course.slug ?? "" }}
								className="flex items-center gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-card transition-all hover:border-brand-primary/30 hover:shadow-card-hover"
							>
								<span className="flex size-9 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light font-stats font-semibold text-brand-primary text-sm">
									{index + 1}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-display text-slate-900">
										{pc.course.title}
									</span>
									{pc.course._count ? (
										<span className="text-slate-400 text-xs">
											{t("card.lessons", { count: pc.course._count.modules })}
										</span>
									) : null}
								</span>
								<BookOpen className="size-4 text-slate-300" />
							</Link>
						))}
					</div>
				</div>

				<aside className="hidden lg:block">
					<div className="sticky top-24 mt-10 rounded-card border border-slate-200 bg-white p-6 shadow-card">
						{path.thumbnailUrl ? (
							<img
								src={path.thumbnailUrl}
								alt=""
								className="mb-4 aspect-video w-full rounded-card object-cover"
							/>
						) : null}
						<p className="font-display text-3xl text-slate-900">{price}</p>
						{earnBadge ? (
							<span className="badge-earnback mt-2">{earnBadge}</span>
						) : null}
						<Link
							to="/register"
							className={cn(
								buttonVariants({ variant: "primary", size: "lg" }),
								"mt-4 w-full",
							)}
						>
							{t("detail.enroll_to_start")}
						</Link>
					</div>
				</aside>
			</div>

			<div className="fixed inset-x-0 bottom-[calc(3.65rem+env(safe-area-inset-bottom))] z-40 border-slate-200 border-t bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur lg:hidden">
				<div className="mx-auto flex max-w-md items-center gap-3">
					<div className="min-w-0 flex-1">
						<p className="truncate font-display text-slate-900">{price}</p>
						{earnBadge ? (
							<span className="text-amber-700 text-xs">{earnBadge}</span>
						) : null}
					</div>
					<Link
						to="/register"
						className="inline-flex h-10 items-center justify-center rounded-btn bg-brand-primary px-4 font-semibold text-sm text-white"
					>
						{t("detail.enroll")}
					</Link>
				</div>
			</div>
		</PublicShell>
	);
}
