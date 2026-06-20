import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Award,
	BookOpen,
	Clock3,
	FileText,
	Layers3,
	LockKeyhole,
	Music,
	PlayCircle,
	Type,
	Video,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { PublicShell } from "@/components/layout/public-shell";
import { FadeIn } from "@/components/marketing/fade-in";
import { buttonVariants } from "@/components/ui/button";
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

	const lessons = course?.modules.flatMap((mod) => mod.lessons) ?? [];
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
				<main className="bg-slate-50 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-16">
					<div className="mx-auto max-w-7xl px-6 py-6 lg:px-8 lg:py-10">
						<div className="space-y-4">
							<Skeleton className="h-64 rounded-card" />
							<Skeleton className="h-40 rounded-card" />
							<Skeleton className="h-72 rounded-card" />
						</div>
					</div>
				</main>
			) : isError || !course ? (
				<main className="bg-slate-50 pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-16">
					<div className="mx-auto max-w-3xl px-6 py-20 lg:px-8">
						<div className="rounded-card border border-slate-200 bg-white px-6 py-20 text-center shadow-card">
							<p className="font-display text-xl text-slate-900">
								{t("detail.not_found_title")}
							</p>
							<p className="mx-auto mt-2 max-w-md text-slate-500 text-sm">
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
						<div className="relative mx-auto max-w-7xl px-6 pt-20 pb-12 lg:px-8 lg:pt-32 lg:pb-16">
							<p className="font-stats font-semibold text-sm text-white/80 uppercase tracking-wide">
								{t("catalog.title")}
							</p>
							<h1 className="mt-2 max-w-3xl font-display text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
								{course.title}
							</h1>
							{course.description ? (
								<p className="mt-4 max-w-2xl text-white/85">
									{course.description}
								</p>
							) : null}
							<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
								<span className="inline-flex items-center gap-1">
									<Layers3 className="size-4" /> {course.modules.length}{" "}
									{t("detail.modules")}
								</span>
								<span className="inline-flex items-center gap-1">
									<PlayCircle className="size-4" /> {lessons.length}{" "}
									{t("detail.lessons")}
								</span>
								<span className="inline-flex items-center gap-1">
									<Clock3 className="size-4" />{" "}
									{t("detail.total_minutes", {
										count: totalMinutes(lessons),
									})}
								</span>
								<span className="rounded-pill bg-white/15 px-2.5 py-0.5 font-stats text-xs">
									{course.level ?? course.language}
								</span>
							</div>
						</div>
					</section>

					<div className="mx-auto max-w-7xl px-6 lg:grid lg:grid-cols-3 lg:gap-10 lg:px-8">
						<div className="pt-10 pb-32 lg:col-span-2 lg:pb-10">
							<div className="flex items-start gap-3 rounded-card border border-brand-primary/15 bg-brand-primary-light/40 p-5">
								<BookOpen className="mt-0.5 size-5 shrink-0 text-brand-primary" />
								<div>
									<h2 className="font-display text-lg text-slate-900">
										{t("detail.micro_lessons")}
									</h2>
									<p className="mt-1 text-slate-600 text-sm">
										{t("detail.start_first_body")}
									</p>
								</div>
							</div>

							<h2 className="mt-10 font-display text-2xl text-slate-900">
								{t("detail.outline_title")}
							</h2>
							<p className="mt-1 text-slate-500 text-sm">
								{t("detail.outline_body")}
							</p>

							<FadeIn className="mt-4">
								<div className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
									<div className="divide-y divide-slate-100">
										{course.modules.map((mod, mi) => (
											<section key={mod.id} className="px-4 py-4 sm:px-6">
												<div className="flex items-start gap-3">
													<span className="flex size-9 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light font-stats font-semibold text-brand-primary text-sm">
														{mi + 1}
													</span>
													<div className="min-w-0 flex-1">
														<h3 className="font-display text-lg text-slate-900">
															{mod.title}
														</h3>
														<p className="mt-0.5 text-slate-500 text-sm">
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
																className="flex items-center gap-3 rounded-btn border border-slate-200 bg-slate-50 px-3 py-3"
															>
																<span className="flex size-9 shrink-0 items-center justify-center rounded-btn bg-white text-brand-primary">
																	<Icon className="size-4" />
																</span>
																<span className="min-w-0 flex-1">
																	<span className="line-clamp-1 font-medium text-slate-800 text-sm">
																		{li + 1}. {lesson.title}
																	</span>
																	<span className="mt-0.5 flex items-center gap-2 text-slate-500 text-xs">
																		{lesson.contentType ??
																			t("detail.lesson_type_fallback")}
																		{duration ? <span>{duration}</span> : null}
																	</span>
																</span>
																<span className="rounded-pill bg-white px-2.5 py-0.5 font-stats text-[0.62rem] text-slate-500 uppercase">
																	{t("detail.preview")}
																</span>
															</div>
														);
													})}
													{mod.lessons.length === 0 ? (
														<div className="rounded-btn border border-dashed border-slate-200 px-4 py-3 text-slate-500 text-sm">
															{t("detail.no_lessons")}
														</div>
													) : null}
												</div>
											</section>
										))}
									</div>
								</div>
							</FadeIn>
						</div>

						<aside className="hidden lg:block">
							<div className="sticky top-24 mt-10 rounded-card border border-slate-200 bg-white p-6 shadow-card">
								{course.thumbnailUrl ? (
									<img
										src={course.thumbnailUrl}
										alt=""
										className="mb-4 aspect-video w-full rounded-card object-cover"
									/>
								) : null}
								<p className="font-display text-3xl text-slate-900">
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
								<Link
									to="/register"
									className={cn(
										buttonVariants({ variant: "primary", size: "lg" }),
										"mt-4 w-full",
									)}
								>
									{t("detail.enroll_to_start")}
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
				</>
			)}

			{course ? (
				<div className="fixed inset-x-0 bottom-[calc(3.65rem+env(safe-area-inset-bottom))] z-40 border-slate-200 border-t bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.35)] backdrop-blur lg:hidden">
					<div className="mx-auto flex max-w-md items-center gap-3">
						<span className="flex size-10 shrink-0 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
							<LockKeyhole className="size-5" />
						</span>
						<div className="min-w-0 flex-1">
							<p className="font-display text-base text-slate-900">
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
								<span className="text-slate-500 text-xs">
									{t("detail.enroll_mobile_hint")}
								</span>
							)}
						</div>
						<Link
							to="/register"
							className="inline-flex h-10 items-center justify-center rounded-btn bg-brand-primary px-4 font-semibold text-sm text-white"
						>
							{t("detail.enroll")}
						</Link>
					</div>
				</div>
			) : null}
		</PublicShell>
	);
}
