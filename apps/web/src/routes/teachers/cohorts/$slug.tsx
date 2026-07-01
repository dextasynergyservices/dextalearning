import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BookOpen,
	CalendarDays,
	GraduationCap,
	Layers3,
	Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { EnrollCta } from "@/components/catalog/enroll-cta";
import { IntroPreview } from "@/components/catalog/intro-preview";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, getPublicCohort } from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers/cohorts/$slug")({
	component: CohortDetailPage,
});

function dateLabel(iso: string | null): string | null {
	if (!iso) return null;
	return new Date(iso).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function CohortDetailPage() {
	const { slug } = Route.useParams();
	const { t } = useTranslation(["academy", "authoring", "dashboard"]);
	const {
		data: cohort,
		isPending,
		isError,
	} = useQuery({
		queryKey: ["public-cohort", slug],
		queryFn: () => getPublicCohort(slug),
	});

	if (isPending) {
		return (
			<PublicShell mobileTitle={t("cohorts.title")} mobileShowBack>
				<div className="mx-auto max-w-5xl space-y-4 px-6 py-10 lg:px-8">
					<Skeleton className="h-56 rounded-card" />
					<Skeleton className="h-64 rounded-card" />
				</div>
			</PublicShell>
		);
	}

	if (isError || !cohort) {
		return (
			<PublicShell mobileTitle={t("cohorts.not_found_title")} mobileShowBack>
				<section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-24 text-center">
					<h1 className="font-display text-2xl text-foreground sm:text-3xl">
						{t("cohorts.not_found_title")}
					</h1>
					<p className="mt-3 text-muted-foreground">
						{t("cohorts.not_found_body")}
					</p>
					<Link
						to="/teachers/cohorts"
						className={cn(
							buttonVariants({ variant: "outline", size: "md" }),
							"mt-6",
						)}
					>
						{t("cohorts.title")}
					</Link>
				</section>
			</PublicShell>
		);
	}

	const price = cohort.isFree
		? t("catalog.free")
		: formatMoney(cohort.currency, cohort.price ?? 0);
	const earnBadge = cohort.isEarnBackEligible
		? cohort.earnBackPercentage && cohort.earnBackPercentage < 100
			? t("catalog.earnback_pct", { pct: cohort.earnBackPercentage })
			: t("catalog.earnback")
		: null;
	const seatsLeft =
		cohort.capacity != null
			? Math.max(0, cohort.capacity - cohort.seatsFilled)
			: null;

	return (
		<PublicShell mobileTitle={cohort.title} mobileShowBack hideFooterOnMobile>
			<section className="relative overflow-hidden bg-hero-bg text-white">
				<div className="relative mx-auto max-w-7xl px-6 pt-20 pb-12 lg:px-8 lg:pt-32 lg:pb-16">
					<p className="flex items-center gap-2 font-stats font-semibold text-sm text-white/80 uppercase tracking-wide">
						<CalendarDays className="size-4" /> {t("cohorts.title")}
					</p>
					<h1 className="mt-2 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
						{cohort.title}
					</h1>
					{cohort.description ? (
						<p className="mt-4 max-w-2xl text-white/85">{cohort.description}</p>
					) : null}
					<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
						{dateLabel(cohort.startsAt) ? (
							<span className="inline-flex items-center gap-1">
								<CalendarDays className="size-4" /> {dateLabel(cohort.startsAt)}
							</span>
						) : null}
						<span className="inline-flex items-center gap-1">
							<Layers3 className="size-4" />{" "}
							{t("paths.courses_count", {
								ns: "authoring",
								defaultValue: "{{count}} courses",
								count: cohort.courses.length,
							})}
						</span>
						{seatsLeft != null ? (
							<span className="inline-flex items-center gap-1">
								<Users className="size-4" />{" "}
								{t("cohorts.seats_left", {
									defaultValue: "{{count}} seats left",
									count: seatsLeft,
								})}
							</span>
						) : null}
					</div>

					<IntroPreview
						intro={cohort.introLesson}
						label={t("detail.preview_watch_cohort", {
							defaultValue: "Watch cohort preview",
						})}
						className="mt-5 bg-card px-5 py-2.5 text-brand-primary text-sm shadow-lg hover:bg-card/90"
					/>
				</div>
			</section>

			<div className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-3 lg:gap-10 lg:px-8">
				<div className="pt-10 pb-32 lg:col-span-2 lg:pb-10">
					<h2 className="font-display text-2xl text-foreground">
						{t("cohorts.courses_title", {
							ns: "authoring",
							defaultValue: "Courses in this cohort",
						})}
					</h2>
					<div className="mt-4 space-y-3">
						{cohort.courses.map((cc, index) => (
							<Link
								key={cc.course.id}
								to="/courses/$slug"
								params={{ slug: cc.course.slug ?? "" }}
								className="flex items-center gap-3 rounded-card border border-border bg-card p-4 shadow-card transition-all hover:border-brand-primary/30 hover:shadow-card-hover"
							>
								<span className="flex size-9 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light font-stats font-semibold text-brand-primary text-sm">
									{index + 1}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block truncate font-display text-foreground">
										{cc.course.title}
									</span>
									{cc.course._count ? (
										<span className="text-muted-foreground text-xs">
											{t("card.lessons", { count: cc.course._count.modules })}
										</span>
									) : null}
								</span>
								<BookOpen className="size-4 text-muted-foreground" />
							</Link>
						))}
					</div>

					{cohort.instructors.length > 0 ? (
						<>
							<h2 className="mt-10 font-display text-2xl text-foreground">
								{t("cohorts.instructors", {
									ns: "authoring",
									defaultValue: "Instructors",
								})}
							</h2>
							<div className="mt-4 flex flex-wrap gap-3">
								{cohort.instructors.map((ci) => (
									<span
										key={ci.user.id}
										className="flex items-center gap-2 rounded-pill border border-border bg-card py-1.5 pr-4 pl-2 text-foreground text-sm shadow-card"
									>
										<span className="flex size-7 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary">
											<GraduationCap className="size-4" />
										</span>
										{ci.user.name}
									</span>
								))}
							</div>
						</>
					) : null}
				</div>

				<aside className="hidden lg:block">
					<div className="sticky top-24 mt-10 rounded-card border border-border bg-card p-6 shadow-card">
						<p className="font-display text-3xl text-foreground">{price}</p>
						{earnBadge ? (
							<span className="badge-earnback mt-2">{earnBadge}</span>
						) : null}
						{dateLabel(cohort.startsAt) ? (
							<p className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
								<CalendarDays className="size-4 text-brand-primary" />
								{t("cohorts.starts", { defaultValue: "Starts" })}{" "}
								{dateLabel(cohort.startsAt)}
							</p>
						) : null}
						{seatsLeft != null ? (
							<p className="mt-2 flex items-center gap-2 text-muted-foreground text-sm">
								<Users className="size-4 text-brand-primary" />
								{t("cohorts.seats_left", {
									defaultValue: "{{count}} seats left",
									count: seatsLeft,
								})}
							</p>
						) : null}
						<div className="mt-5">
							<EnrollCta type="cohort" id={cohort.id} size="lg" />
						</div>
					</div>
				</aside>
			</div>

			<div className="fixed inset-x-0 bottom-[calc(3.65rem+env(safe-area-inset-bottom))] z-40 border-border border-t bg-card/95 px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur lg:hidden">
				<div className="mx-auto flex max-w-md items-center gap-3">
					<div className="min-w-0 flex-1">
						<p className="truncate font-display text-foreground">{price}</p>
						{dateLabel(cohort.startsAt) ? (
							<span className="text-muted-foreground text-xs">
								{t("cohorts.starts", { defaultValue: "Starts" })}{" "}
								{dateLabel(cohort.startsAt)}
							</span>
						) : null}
					</div>
					<EnrollCta type="cohort" id={cohort.id} size="sm" />
				</div>
			</div>
		</PublicShell>
	);
}
