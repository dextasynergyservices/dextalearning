import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Award,
	BookOpen,
	CalendarRange,
	Clock3,
	FileText,
	Layers3,
	LockKeyhole,
	Music,
	Play,
	PlayCircle,
	Type,
	Video,
	X,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import { useTranslation } from "react-i18next";
import { EnrollCta } from "@/components/catalog/enroll-cta";
import { InstructorByline } from "@/components/catalog/instructor-byline";
import { PublicShell } from "@/components/layout/public-shell";
import { FadeIn } from "@/components/marketing/fade-in";
import { LessonPlayer } from "@/components/player/lesson-player";
import { buttonVariants } from "@/components/ui/button";
import { RichText } from "@/components/ui/rich-text";
import { Skeleton } from "@/components/ui/skeleton";
import {
	formatMoney,
	getPublicCourse,
	type PublicLesson,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/courses/$slug")({
	component: CoursePage,
});

const TYPE_ICON: Record<string, ComponentType<{ className?: string }>> = {
	video: Video,
	audio: Music,
	text: Type,
	pdf: FileText,
};

function durationLabel(lesson: PublicLesson): string | null {
	const sec = lesson.videoDurationSec ?? lesson.audioDurationSec;
	if (!sec) return null;
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

function totalMinutes(lessons: PublicLesson[]): number {
	const seconds = lessons.reduce(
		(total, lesson) =>
			total + (lesson.videoDurationSec ?? lesson.audioDurationSec ?? 0),
		0,
	);
	return Math.max(1, Math.ceil(seconds / 60));
}

function HeroChip({
	icon: Icon,
	text,
	capitalize,
}: {
	icon?: ComponentType<{ className?: string }>;
	text: string;
	capitalize?: boolean;
}) {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-3 py-1 font-medium text-sm text-white/90 ring-1 ring-white/10">
			{Icon ? <Icon className="size-3.5" /> : null}
			<span className={capitalize ? "capitalize" : undefined}>{text}</span>
		</span>
	);
}

function CoursePage() {
	const { slug } = Route.useParams();
	const { t } = useTranslation("academy");
	const {
		data: course,
		isPending,
		isError,
	} = useQuery({
		queryKey: ["public-course", slug],
		queryFn: () => getPublicCourse(slug),
	});

	const [preview, setPreview] = useState<PublicLesson | null>(null);

	const lessons = course?.modules.flatMap((mod) => mod.lessons) ?? [];
	const previewLessons = lessons.filter((l) => l.isPreview);
	const firstPreview = previewLessons[0] ?? null;
	const includes = course
		? [
				{
					icon: Layers3,
					text: t("detail.modules_count", { count: course.modules.length }),
				},
				{
					icon: PlayCircle,
					text: t("detail.includes_lessons", { count: lessons.length }),
				},
				{
					icon: Clock3,
					text: t("detail.total_minutes", { count: totalMinutes(lessons) }),
				},
				{ icon: Award, text: t("detail.includes_certificate") },
				{ icon: FileText, text: t("detail.includes_transcript") },
			]
		: [];

	return (
		<PublicShell
			mobileTitle={course?.title ?? t("catalog.title")}
			mobileShowBack
			hideFooterOnMobile
		>
			{isPending ? (
				<main className="bg-muted pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-16">
					<div className="mx-auto max-w-7xl px-6 py-6 lg:px-8 lg:py-10">
						<div className="space-y-4">
							<Skeleton className="h-64 rounded-card" />
							<Skeleton className="h-40 rounded-card" />
							<Skeleton className="h-72 rounded-card" />
						</div>
					</div>
				</main>
			) : isError || !course ? (
				<main className="bg-muted pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-16">
					<div className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
						<div className="rounded-card border border-border bg-card px-6 py-20 text-center shadow-card">
							<p className="font-display text-xl text-foreground">
								{t("detail.not_found_title")}
							</p>
							<p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
								{t("detail.not_found_body")}
							</p>
							<Link
								to="/teachers/courses"
								className={cn(
									buttonVariants({ variant: "primary", size: "md" }),
									"mt-4",
								)}
							>
								{t("landing.browse_courses")}
							</Link>
						</div>
					</div>
				</main>
			) : (
				<>
					<section className="relative overflow-hidden bg-hero-bg text-white">
						<div className="-top-32 -right-24 pointer-events-none absolute size-96 rounded-full bg-brand-primary/25 blur-3xl" />
						<div className="-bottom-32 -left-24 pointer-events-none absolute size-96 rounded-full bg-brand-accent/15 blur-3xl" />
						<div className="relative mx-auto max-w-7xl px-6 pt-20 pb-14 lg:px-8 lg:pt-28 lg:pb-20">
							<div className="grid items-center gap-10 lg:grid-cols-[1.5fr_1fr]">
								<div>
									<p className="flex items-center gap-2 font-stats font-semibold text-sm text-white/80 uppercase tracking-wide">
										<BookOpen className="size-4" /> {t("catalog.title")}
									</p>
									<h1 className="mt-3 font-display text-3xl leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
										{course.title}
									</h1>
									{course.description ? (
										<RichText
											html={course.description}
											invert
											className="mt-4 max-w-xl text-white/80"
										/>
									) : null}
									<div className="mt-6 flex flex-wrap gap-2">
										<HeroChip
											icon={Layers3}
											text={`${course.modules.length} ${t("detail.modules")}`}
										/>
										<HeroChip
											icon={PlayCircle}
											text={`${lessons.length} ${t("detail.lessons")}`}
										/>
										<HeroChip
											icon={Clock3}
											text={t("detail.total_minutes", {
												count: totalMinutes(lessons),
											})}
										/>
										{course.estimatedDuration ? (
											<HeroChip
												icon={CalendarRange}
												text={course.estimatedDuration}
											/>
										) : null}
										<HeroChip
											text={course.level ?? course.language}
											capitalize
										/>
									</div>
								</div>

								<div className="relative hidden lg:block">
									{firstPreview ? (
										<button
											type="button"
											onClick={() => setPreview(firstPreview)}
											className="group relative block w-full overflow-hidden rounded-card border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
										>
											{course.thumbnailUrl ? (
												<img
													src={course.thumbnailUrl}
													alt=""
													className="aspect-video w-full object-cover"
												/>
											) : (
												<div className="flex aspect-video w-full items-center justify-center bg-white/5 text-white/25">
													<BookOpen className="size-16" />
												</div>
											)}
											<span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 transition-colors group-hover:bg-black/50">
												<span className="flex size-16 items-center justify-center rounded-full bg-card/90 text-brand-primary shadow-lg transition-transform group-hover:scale-105">
													<Play className="size-7 translate-x-0.5 fill-current" />
												</span>
												<span className="font-semibold text-sm text-white">
													{t("detail.preview_watch", {
														defaultValue: "Watch free preview",
													})}
												</span>
											</span>
										</button>
									) : (
										<div className="overflow-hidden rounded-card border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
											{course.thumbnailUrl ? (
												<img
													src={course.thumbnailUrl}
													alt=""
													className="aspect-video w-full object-cover"
												/>
											) : (
												<div className="flex aspect-video w-full items-center justify-center bg-white/5 text-white/25">
													<BookOpen className="size-16" />
												</div>
											)}
										</div>
									)}
								</div>
							</div>
						</div>
					</section>

					<div className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-3 lg:gap-10 lg:px-8">
						<div className="pt-10 pb-32 lg:col-span-2 lg:pb-10">
							{firstPreview ? (
								<button
									type="button"
									onClick={() => setPreview(firstPreview)}
									className="group flex w-full items-center gap-4 rounded-card border border-brand-primary/30 bg-brand-primary-light/50 p-5 text-left transition-colors hover:bg-brand-primary-light"
								>
									<span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm transition-transform group-hover:scale-105">
										<Play className="size-5 translate-x-0.5 fill-current" />
									</span>
									<span className="min-w-0 flex-1">
										<span className="flex items-center gap-2">
											<span className="font-display text-lg text-foreground">
												{t("detail.preview_watch", {
													defaultValue: "Watch free preview",
												})}
											</span>
											<span className="rounded-pill bg-brand-primary px-2 py-0.5 font-stats font-semibold text-[0.6rem] text-white uppercase">
												{t("detail.free", { defaultValue: "Free" })}
											</span>
										</span>
										<span className="mt-0.5 block text-muted-foreground text-sm">
											{t("detail.preview_count", {
												defaultValue:
													"{{count}} lessons free to preview before you enroll.",
												count: previewLessons.length,
											})}
										</span>
									</span>
									<ArrowRight className="size-5 shrink-0 text-brand-primary transition-transform group-hover:translate-x-0.5" />
								</button>
							) : (
								<div className="flex items-start gap-3 rounded-card border border-brand-primary/15 bg-brand-primary-light/40 p-5">
									<BookOpen className="mt-0.5 size-5 shrink-0 text-brand-primary" />
									<div>
										<h2 className="font-display text-lg text-foreground">
											{t("detail.micro_lessons")}
										</h2>
										<p className="mt-1 text-muted-foreground text-sm">
											{t("detail.start_first_body")}
										</p>
									</div>
								</div>
							)}

							<h2 className="mt-10 font-display text-2xl text-foreground">
								{t("detail.outline_title")}
							</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								{t("detail.outline_body")}
							</p>

							<FadeIn className="mt-4">
								<div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
									<div className="divide-y divide-slate-100">
										{course.modules.map((mod, mi) => (
											<section key={mod.id} className="px-4 py-4 sm:px-6">
												<div className="flex items-start gap-3">
													<span className="flex size-9 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light font-stats font-semibold text-brand-primary text-sm">
														{mi + 1}
													</span>
													<div className="min-w-0 flex-1">
														<h3 className="font-display text-lg text-foreground">
															{mod.title}
														</h3>
														<p className="mt-0.5 text-muted-foreground text-sm">
															{t("card.lessons", { count: mod.lessons.length })}
														</p>
													</div>
												</div>

												<div className="mt-3 space-y-2">
													{mod.lessons.map((lesson, li) => {
														const Icon =
															TYPE_ICON[lesson.contentType ?? ""] ?? Type;
														const duration = durationLabel(lesson);
														return (
															<div
																key={lesson.id}
																className="flex items-center gap-3 rounded-btn border border-border bg-muted px-3 py-3"
															>
																<span className="flex size-9 shrink-0 items-center justify-center rounded-btn bg-card text-brand-primary">
																	<Icon className="size-4" />
																</span>
																<span className="min-w-0 flex-1">
																	<span className="line-clamp-1 font-medium text-foreground text-sm">
																		{li + 1}. {lesson.title}
																	</span>
																	<span className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
																		{lesson.contentType ??
																			t("detail.lesson_type_fallback")}
																		{duration ? <span>{duration}</span> : null}
																	</span>
																</span>
																{lesson.isPreview ? (
																	<button
																		type="button"
																		onClick={() => setPreview(lesson)}
																		className="flex shrink-0 items-center gap-1 rounded-pill bg-brand-primary px-2.5 py-1 font-stats font-semibold text-[0.62rem] text-white uppercase transition-colors hover:bg-brand-primary-hover"
																	>
																		<Play className="size-3" />
																		{t("detail.preview")}
																	</button>
																) : (
																	<LockKeyhole className="size-4 shrink-0 text-muted-foreground" />
																)}
															</div>
														);
													})}
													{mod.lessons.length === 0 ? (
														<div className="rounded-btn border border-dashed border-border px-4 py-3 text-muted-foreground text-sm">
															{t("detail.no_lessons")}
														</div>
													) : null}
												</div>
											</section>
										))}
									</div>
								</div>
							</FadeIn>
							{course.instructor ? (
								<div className="mt-10">
									<InstructorByline instructor={course.instructor} />
								</div>
							) : null}
						</div>

						<aside className="hidden lg:block">
							<div className="sticky top-24 mt-10 rounded-card border border-border bg-card p-6 shadow-card">
								<p className="font-display text-3xl text-foreground">
									{course.isFree
										? t("catalog.free")
										: formatMoney(course.currency, course.price ?? 0)}
								</p>
								{course.isEarnBackEligible ? (
									<span className="badge-earnback mt-2">
										{course.earnBackPercentage &&
										course.earnBackPercentage < 100
											? t("catalog.earnback_pct", {
													pct: course.earnBackPercentage,
												})
											: t("catalog.earnback")}
									</span>
								) : null}
								<div className="mt-4">
									<EnrollCta type="course" id={course.id} size="lg" />
								</div>
								<h3 className="mt-6 font-display text-foreground">
									{t("detail.includes_title")}
								</h3>
								<ul className="mt-3 space-y-2.5">
									{includes.map(({ icon: Icon, text }) => (
										<li
											key={text}
											className="flex items-center gap-3 text-muted-foreground text-sm"
										>
											<Icon className="size-4 text-brand-primary" /> {text}
										</li>
									))}
								</ul>
							</div>
						</aside>
					</div>
				</>
			)}

			{course ? (
				<div className="fixed inset-x-0 bottom-[calc(3.65rem+env(safe-area-inset-bottom))] z-40 border-border border-t bg-card/95 px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur lg:hidden">
					<div className="mx-auto flex max-w-md items-center gap-3">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
							<LockKeyhole className="size-5" />
						</span>
						<div className="min-w-0 flex-1">
							<p className="font-display text-base text-foreground">
								{course.isFree
									? t("catalog.free")
									: formatMoney(course.currency, course.price ?? 0)}
							</p>
							{course.isEarnBackEligible ? (
								<span className="text-amber-700 text-xs">
									{course.earnBackPercentage && course.earnBackPercentage < 100
										? t("catalog.earnback_pct", {
												pct: course.earnBackPercentage,
											})
										: t("catalog.earnback")}
								</span>
							) : (
								<span className="text-muted-foreground text-xs">
									{t("detail.enroll_mobile_hint")}
								</span>
							)}
						</div>
						<EnrollCta type="course" id={course.id} size="sm" />
					</div>
				</div>
			) : null}

			{/* Free-preview player (§2.4) — public, no enrolment. */}
			{preview ? (
				<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm sm:items-center sm:p-4">
					<div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-card bg-card shadow-modal sm:rounded-card">
						<div className="flex items-center justify-between gap-3 border-border border-b px-5 py-3.5">
							<div className="min-w-0">
								<p className="font-stats font-semibold text-brand-primary text-xs uppercase">
									{t("detail.preview")}
								</p>
								<p className="truncate font-display text-foreground">
									{preview.title}
								</p>
							</div>
							<button
								type="button"
								aria-label={t("detail.close", { defaultValue: "Close" })}
								onClick={() => setPreview(null)}
								className="flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground hover:bg-accent"
							>
								<X className="size-5" />
							</button>
						</div>
						<div className="overflow-y-auto p-5">
							<LessonPlayer
								lessonId={preview.id}
								title={preview.title}
								preview
							/>
						</div>
					</div>
				</div>
			) : null}
		</PublicShell>
	);
}
