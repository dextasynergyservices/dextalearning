import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Award,
	CalendarRange,
	CheckCircle2,
	Clock3,
	Layers3,
	Target,
	Waypoints,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { EnrollCta } from "@/components/catalog/enroll-cta";
import { InstructorByline } from "@/components/catalog/instructor-byline";
import { IntroPreview } from "@/components/catalog/intro-preview";
import { PublicShell } from "@/components/layout/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RichText } from "@/components/ui/rich-text";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { formatMoney, getPathProgress, getPublicPath } from "@/lib/content-api";
import { contentLengthLabel } from "@/lib/duration";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/teachers/paths/$slug")({
	component: PathDetailPage,
});

function PathDetailPage() {
	const { slug } = Route.useParams();
	const { t } = useTranslation(["academy", "authoring", "dashboard"]);
	const { t: tA } = useTranslation("authoring");
	const { data: session } = useSession();
	const userId = session?.user?.id;
	const isLearner = Boolean(userId);

	const {
		data: path,
		isPending,
		isError,
	} = useQuery({
		queryKey: ["public-path", slug],
		queryFn: () => getPublicPath(slug),
	});

	// User-scoped key so one learner never sees another's cached progress.
	const { data: progress } = useQuery({
		queryKey: ["progress", "path", path?.id, userId],
		queryFn: () => getPathProgress(path?.id ?? ""),
		enabled: isLearner && Boolean(path?.id),
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
					<h1 className="font-display text-2xl text-foreground sm:text-3xl">
						{t("paths.not_found_title")}
					</h1>
					<p className="mt-3 text-muted-foreground">
						{t("paths.not_found_body")}
					</p>
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

	const totalMinutes = path.pathCourses.reduce(
		(sum, pc) => sum + (pc.course.contentMinutes ?? 0),
		0,
	);
	const contentLabel = contentLengthLabel(tA, totalMinutes);

	const pct = progress?.summary.percent ?? 0;
	const started = isLearner && pct > 0;
	const progByCourse = new Map((progress?.courses ?? []).map((c) => [c.id, c]));

	const includes: { icon: typeof Layers3; text: string }[] = [
		{
			icon: Layers3,
			text: tA("paths.courses_count", {
				defaultValue: "{{count}} courses",
				count: path.pathCourses.length,
			}),
		},
		...(contentLabel
			? [
					{
						icon: Clock3,
						text: `${contentLabel} ${t("detail.of_content", { defaultValue: "of content" })}`,
					},
				]
			: []),
		...(path.estimatedDuration
			? [{ icon: CalendarRange, text: path.estimatedDuration }]
			: []),
		{
			icon: Award,
			text: t("detail.includes_certificate", {
				defaultValue: "Certificate of completion",
			}),
		},
	];

	return (
		<PublicShell mobileTitle={path.title} mobileShowBack hideFooterOnMobile>
			{/* Hero */}
			<section className="relative overflow-hidden bg-hero-bg text-white">
				<div className="relative mx-auto max-w-7xl px-6 pt-20 pb-12 lg:px-8 lg:pt-32 lg:pb-16">
					<p className="flex items-center gap-2 font-stats font-semibold text-sm text-white/80 uppercase tracking-wide">
						<Waypoints className="size-4" /> {t("paths.title")}
					</p>
					<h1 className="mt-2 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
						{path.title}
					</h1>
					{path.outcomeStatement || path.description ? (
						<RichText
							html={(path.outcomeStatement || path.description) ?? ""}
							invert
							className="mt-4 max-w-2xl text-white/85"
						/>
					) : null}
					<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
						<span className="inline-flex items-center gap-1.5">
							<Layers3 className="size-4" />
							{tA("paths.courses_count", {
								defaultValue: "{{count}} courses",
								count: path.pathCourses.length,
							})}
						</span>
						{contentLabel ? (
							<span className="inline-flex items-center gap-1.5">
								<Clock3 className="size-4" /> {contentLabel}
							</span>
						) : null}
						{path.estimatedDuration ? (
							<span className="inline-flex items-center gap-1.5">
								<CalendarRange className="size-4" /> {path.estimatedDuration}
							</span>
						) : null}
						{path.level ? (
							<span className="rounded-pill bg-white/15 px-2.5 py-0.5 font-stats text-xs capitalize">
								{path.level}
							</span>
						) : null}
					</div>

					<IntroPreview
						intro={path.introLesson}
						label={t("detail.preview_watch_path", {
							defaultValue: "Watch path preview",
						})}
						className="mt-5 bg-card px-5 py-2.5 text-brand-primary text-sm shadow-lg hover:bg-card/90"
					/>

					{started ? (
						<div className="mt-6 max-w-md">
							<div className="flex items-center justify-between text-white/80 text-xs">
								<span>
									{t("detail.progress_complete", {
										defaultValue: "{{percent}}% complete",
										percent: pct,
									})}
								</span>
								<span>
									{progress?.summary.coursesComplete}/
									{progress?.summary.coursesTotal}
								</span>
							</div>
							<div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20">
								<div
									className="h-full rounded-full bg-card"
									style={{ width: `${pct}%` }}
								/>
							</div>
						</div>
					) : null}
				</div>
			</section>

			{/* Body */}
			<div className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-3 lg:gap-10 lg:px-8">
				<div className="pt-8 pb-32 lg:col-span-2 lg:pb-12">
					{path.outcomeStatement ? (
						<div className="flex items-start gap-3 rounded-card border border-brand-primary/15 bg-brand-primary-light/40 p-5">
							<Target className="mt-0.5 size-5 shrink-0 text-brand-primary" />
							<div className="min-w-0">
								<h2 className="font-display text-lg text-foreground">
									{tA("paths.outcome", { defaultValue: "Outcome" })}
								</h2>
								<RichText
									html={path.outcomeStatement}
									className="mt-1 text-muted-foreground text-sm"
								/>
							</div>
						</div>
					) : null}

					<h2 className="mt-10 font-display text-2xl text-foreground">
						{tA("paths.courses_title", {
							defaultValue: "Courses in this path",
						})}
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						{t("detail.path_journey_body", {
							defaultValue:
								"Work through each course in order to complete the path.",
						})}
					</p>

					<ol className="mt-5 space-y-3">
						{path.pathCourses.map((pc, index) => {
							const cp = progByCourse.get(pc.course.id);
							const done = Boolean(cp?.isComplete);
							const cPct = cp?.percent ?? 0;
							const mins = contentLengthLabel(
								tA,
								pc.course.contentMinutes ?? 0,
							);
							return (
								<li key={pc.course.id}>
									<Link
										to="/courses/$slug"
										params={{ slug: pc.course.slug ?? "" }}
										className="group flex items-center gap-4 rounded-card border border-border bg-card p-4 shadow-card transition-all hover:border-brand-primary/40 hover:shadow-card-hover"
									>
										<span
											className={cn(
												"flex size-10 shrink-0 items-center justify-center rounded-full font-stats font-bold text-sm",
												done
													? "bg-success text-white"
													: "bg-brand-primary-light text-brand-primary",
											)}
										>
											{done ? <CheckCircle2 className="size-5" /> : index + 1}
										</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate font-display text-foreground">
												{pc.course.title}
											</span>
											<span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
												<span className="flex items-center gap-1">
													<Layers3 className="size-3.5" />
													{tA("courses.modules", {
														count: pc.course._count?.modules ?? 0,
													})}
												</span>
												{mins ? (
													<span className="flex items-center gap-1">
														<Clock3 className="size-3.5" />
														{mins}
													</span>
												) : null}
												{pc.isRequired === false ? (
													<span className="rounded-pill bg-muted px-2 py-0.5 text-muted-foreground">
														{t("detail.optional", { defaultValue: "Optional" })}
													</span>
												) : null}
											</span>
											{started && cPct > 0 && !done ? (
												<span className="mt-2 flex items-center gap-2">
													<span className="flex h-1.5 max-w-[12rem] flex-1 overflow-hidden rounded-full bg-muted">
														<span
															className="h-full rounded-full bg-brand-solid"
															style={{ width: `${cPct}%` }}
														/>
													</span>
													<span className="font-stats text-muted-foreground text-xs">
														{cPct}%
													</span>
												</span>
											) : null}
										</span>
										<ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
									</Link>
								</li>
							);
						})}
						{path.pathCourses.length === 0 ? (
							<li className="list-none">
								<EmptyState
									title={tA("paths.no_courses", {
										defaultValue: "No courses yet.",
									})}
								/>
							</li>
						) : null}
					</ol>
					{path.instructor ? (
						<div className="mt-8">
							<InstructorByline instructor={path.instructor} />
						</div>
					) : null}
				</div>

				{/* Sticky sidebar (desktop) */}
				<aside className="hidden lg:block">
					<div className="sticky top-24 mt-8 rounded-card border border-border bg-card p-6 shadow-card">
						{path.thumbnailUrl ? (
							<img
								src={path.thumbnailUrl}
								alt=""
								className="mb-4 aspect-video w-full rounded-card object-cover"
							/>
						) : (
							<div className="mb-4 flex aspect-video w-full items-center justify-center rounded-card bg-brand-primary-light text-brand-primary/40">
								<Waypoints className="size-10" />
							</div>
						)}
						<p className="font-display text-3xl text-foreground">{price}</p>
						{earnBadge ? (
							<span className="badge-earnback mt-2">{earnBadge}</span>
						) : null}

						{started ? (
							<div className="mt-4">
								<div className="flex items-center justify-between text-muted-foreground text-xs">
									<span>
										{t("detail.progress_complete", {
											defaultValue: "{{percent}}% complete",
											percent: pct,
										})}
									</span>
									<span>
										{progress?.summary.coursesComplete}/
										{progress?.summary.coursesTotal}
									</span>
								</div>
								<div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-brand-solid"
										style={{ width: `${pct}%` }}
									/>
								</div>
							</div>
						) : null}

						<div className="mt-4">
							<EnrollCta
								type="path"
								id={path.id}
								size="lg"
								commercials={{
									title: path.title,
									price: path.price ?? 0,
									currency: path.currency,
									isFree: path.isFree,
									isEarnBackEligible: path.isEarnBackEligible,
									earnBackPercentage: path.earnBackPercentage,
									earnBackDeadlineDays: path.earnBackDeadlineDays,
								}}
							/>
						</div>

						<h3 className="mt-6 font-display text-foreground">
							{t("detail.path_includes_title", {
								defaultValue: "This path includes",
							})}
						</h3>
						<ul className="mt-3 space-y-2.5">
							{includes.map(({ icon: Icon, text }) => (
								<li
									key={text}
									className="flex items-center gap-3 text-muted-foreground text-sm"
								>
									<Icon className="size-4 shrink-0 text-brand-primary" /> {text}
								</li>
							))}
						</ul>
					</div>
				</aside>
			</div>

			{/* Sticky bottom bar (mobile) */}
			<div className="fixed inset-x-0 bottom-[calc(3.65rem+env(safe-area-inset-bottom))] z-40 border-border border-t bg-card/95 px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur lg:hidden">
				<div className="mx-auto flex max-w-md items-center gap-3">
					<div className="min-w-0 flex-1">
						<p className="truncate font-display text-foreground">{price}</p>
						{started ? (
							<span className="text-brand-primary text-xs">
								{t("detail.progress_complete", {
									defaultValue: "{{percent}}% complete",
									percent: pct,
								})}
							</span>
						) : earnBadge ? (
							<span className="text-amber-700 text-xs">{earnBadge}</span>
						) : null}
					</div>
					<EnrollCta
						type="path"
						id={path.id}
						size="sm"
						commercials={{
							title: path.title,
							price: path.price ?? 0,
							currency: path.currency,
							isFree: path.isFree,
							isEarnBackEligible: path.isEarnBackEligible,
							earnBackPercentage: path.earnBackPercentage,
							earnBackDeadlineDays: path.earnBackDeadlineDays,
						}}
					/>
				</div>
			</div>
		</PublicShell>
	);
}
