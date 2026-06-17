import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Award,
	CalendarDays,
	Check,
	ChevronRight,
	Clock,
	UserRound,
	Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { formatNgn, formatShortDate } from "@/lib/format";
import { getCohortBySlug, getCourseBySlug } from "@/lib/sample-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers/cohorts/$slug")({
	component: CohortDetailPage,
});

function CohortDetailPage() {
	const { slug } = Route.useParams();
	const { t, i18n } = useTranslation("academy");
	const cohort = getCohortBySlug(slug);

	if (!cohort) {
		return (
			<PublicShell mobileTitle={t("cohorts.not_found_title")} mobileShowBack>
				<section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-24 text-center">
					<h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
						{t("cohorts.not_found_title")}
					</h1>
					<p className="mt-3 text-slate-500">{t("cohorts.not_found_body")}</p>
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

	const locale = i18n.resolvedLanguage ?? "en";
	const isFree = cohort.priceNgn === 0;
	const priceLabel = isFree ? t("card.free") : formatNgn(cohort.priceNgn);
	const enrollLabel = isFree ? t("detail.enroll_free") : t("detail.enroll");
	const seatsLeft = Math.max(0, cohort.capacity - cohort.seatsFilled);
	const fillPct = Math.round((cohort.seatsFilled / cohort.capacity) * 100);
	const courses = cohort.courseSlugs
		.map((courseSlug) => getCourseBySlug(courseSlug))
		.filter((course) => course !== undefined);

	const includes = [
		{ icon: CalendarDays, text: t("cohorts.weeks", { count: cohort.weeks }) },
		{ icon: UserRound, text: cohort.facilitatorName },
		{ icon: Award, text: t("detail.includes_certificate") },
		{
			icon: Clock,
			text: t("cohorts.starts", {
				date: formatShortDate(cohort.startsAt, locale),
			}),
		},
	];

	return (
		<PublicShell mobileTitle={cohort.title} mobileShowBack>
			<section
				className={cn(
					"relative overflow-hidden bg-gradient-to-br text-white",
					cohort.gradient,
				)}
			>
				<div className="relative mx-auto max-w-7xl px-6 pt-20 pb-12 lg:px-8 lg:pt-32 lg:pb-16">
					<p className="font-stats font-semibold text-white/80 text-sm uppercase tracking-wide">
						{t("cohorts.title")}
					</p>
					<h1 className="mt-2 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
						{cohort.title}
					</h1>
					<p className="mt-4 max-w-2xl text-white/85">{cohort.summary}</p>
					<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
						<span className="inline-flex items-center gap-1">
							<CalendarDays className="size-4" />{" "}
							{t("cohorts.starts", {
								date: formatShortDate(cohort.startsAt, locale),
							})}
						</span>
						<span className="inline-flex items-center gap-1">
							<Clock className="size-4" />{" "}
							{t("cohorts.weeks", { count: cohort.weeks })}
						</span>
						<span className="inline-flex items-center gap-1">
							<UserRound className="size-4" /> {cohort.facilitatorName}
						</span>
						<span className="rounded-pill bg-white/15 px-2.5 py-0.5 font-stats text-xs">
							{t(`level.${cohort.level}`)}
						</span>
					</div>
				</div>
			</section>

			<div className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-3 lg:gap-10 lg:px-8">
				<div className="pt-10 pb-32 lg:col-span-2 lg:pb-10">
					{/* What's included / highlights */}
					<h2 className="font-display text-2xl text-slate-900">
						{t("cohorts.whats_included")}
					</h2>
					<ul className="mt-4 grid gap-3 sm:grid-cols-2">
						{cohort.highlights.map((highlight) => (
							<li key={highlight} className="flex items-start gap-2.5">
								<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
									<Check className="size-3.5" />
								</span>
								<span className="text-slate-600 text-sm">{highlight}</span>
							</li>
						))}
					</ul>

					{/* Courses covered */}
					<h2 className="mt-10 font-display text-2xl text-slate-900">
						{t("cohorts.includes_courses")}
					</h2>
					<ol className="mt-4 space-y-3">
						{courses.map((course, index) => (
							<li key={course.slug}>
								<Link
									to="/teachers/courses/$slug"
									params={{ slug: course.slug }}
									className="group flex items-center gap-4 rounded-card border border-slate-200 bg-white p-4 transition-colors hover:border-brand-primary/30"
								>
									<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary-light font-stats font-semibold text-brand-primary text-sm">
										{index + 1}
									</span>
									<div className="min-w-0 flex-1">
										<p className="truncate font-medium text-slate-900">
											{course.title}
										</p>
										<p className="text-slate-500 text-xs">
											{t("card.lessons", { count: course.lessonCount })} ·{" "}
											{course.durationHours}h
										</p>
									</div>
									<ChevronRight className="size-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-primary" />
								</Link>
							</li>
						))}
					</ol>
				</div>

				{/* Desktop sticky sidebar */}
				<aside className="hidden lg:block">
					<div className="sticky top-24 mt-10 rounded-card border border-slate-200 bg-white p-6 shadow-card">
						<p className="font-display text-3xl text-slate-900">{priceLabel}</p>
						{cohort.isEarnBack ? (
							<span className="badge-earnback mt-2">{t("card.earn_back")}</span>
						) : null}

						{/* Seats */}
						<div className="mt-4">
							<div className="h-2 overflow-hidden rounded-full bg-slate-100">
								<div
									className="h-full rounded-full bg-brand-accent"
									style={{ width: `${fillPct}%` }}
								/>
							</div>
							<p className="mt-2 inline-flex items-center gap-1 text-amber-600 text-xs">
								<Users className="size-3.5" />{" "}
								{t("cohorts.seats_left", { count: seatsLeft })}
							</p>
						</div>

						<Link
							to="/register"
							className={cn(
								buttonVariants({ variant: "primary", size: "lg" }),
								"mt-4 w-full",
							)}
						>
							{enrollLabel}
						</Link>
						<h3 className="mt-6 font-display text-slate-900">
							{t("detail.includes_title")}
						</h3>
						<ul className="mt-3 space-y-2.5">
							{includes.map(({ icon: Icon, text }) => (
								<li
									key={text}
									className="flex items-center gap-3 text-slate-600 text-sm"
								>
									<Icon className="size-4 text-brand-primary" /> {text}
								</li>
							))}
						</ul>
					</div>
				</aside>
			</div>

			{/* Native sticky enroll bar (mobile) */}
			<div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-slate-200 border-t bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden">
				<div className="leading-tight">
					<p className="font-display text-lg text-slate-900">{priceLabel}</p>
					<p className="text-amber-600 text-xs">
						{t("cohorts.seats_left", { count: seatsLeft })}
					</p>
				</div>
				<Link
					to="/register"
					className={cn(
						buttonVariants({ variant: "primary", size: "md" }),
						"ml-auto flex-1",
					)}
				>
					{enrollLabel}
				</Link>
			</div>
		</PublicShell>
	);
}
