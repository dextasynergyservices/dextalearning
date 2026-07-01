import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BookOpen,
	CheckCircle2,
	ChevronRight,
	Circle,
	ClipboardCheck,
	FolderKanban,
	GraduationCap,
	Layers,
	PlayCircle,
	Trophy,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { LearnerShell } from "@/components/layout/learner-shell";
import { ProgressRing } from "@/components/learn/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { type CourseProgress, getCourseProgress } from "@/lib/content-api";
import { htmlToText } from "@/lib/rich-text";

export const Route = createFileRoute("/learn/course/$courseId")({
	component: CourseHubRoute,
});

function CourseHubRoute() {
	const { courseId } = Route.useParams();
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: ["course-progress", courseId],
		queryFn: () => getCourseProgress(courseId),
	});

	return (
		<LearnerShell
			title={data?.course.title ?? t("hub.title", { defaultValue: "Course" })}
		>
			<div className="mx-auto max-w-5xl px-4 py-6">
				{isPending || !data ? (
					<div className="space-y-5">
						<Skeleton className="h-44 rounded-card" />
						<div className="grid gap-6 lg:grid-cols-[1fr_300px]">
							<Skeleton className="h-64 rounded-card" />
							<Skeleton className="hidden h-48 rounded-card lg:block" />
						</div>
					</div>
				) : (
					<CourseHub progress={data} />
				)}
			</div>
		</LearnerShell>
	);
}

function CourseHub({ progress }: { progress: CourseProgress }) {
	const { t } = useTranslation("authoring");
	const s = progress.summary;
	const nextLesson = progress.modules
		.flatMap((m) => m.lessons)
		.find((l) => !l.done);

	const moduleCount = progress.modules.length;

	return (
		<div className="space-y-6">
			{/* ── Hero ─────────────────────────────────────────────────────────── */}
			<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
				<div className="grid sm:grid-cols-[230px_1fr]">
					<div className="relative aspect-[16/9] bg-gradient-to-br from-brand-primary/15 to-brand-accent/15 sm:aspect-auto">
						{progress.course.thumbnailUrl ? (
							<img
								src={progress.course.thumbnailUrl}
								alt=""
								className="absolute inset-0 size-full object-cover"
							/>
						) : (
							<div className="flex size-full items-center justify-center text-brand-primary/40">
								<GraduationCap className="size-12" />
							</div>
						)}
					</div>
					<div className="p-5 sm:p-6">
						<p className="font-stats font-semibold text-brand-primary text-xs uppercase tracking-wide">
							{t("hub.eyebrow_course", { defaultValue: "Course" })}
						</p>
						<h1 className="mt-1 font-display text-2xl text-foreground leading-tight">
							{progress.course.title}
						</h1>
						{progress.course.description ? (
							<p className="mt-2 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
								{htmlToText(progress.course.description)}
							</p>
						) : null}
						<div className="mt-5 flex items-center gap-4">
							<ProgressRing
								value={s.percent}
								complete={s.isComplete}
								size={64}
							/>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-foreground text-sm">
									{t("hub.lessons_progress", {
										defaultValue: "{{done}}/{{total}} lessons complete",
										done: s.lessonsDone,
										total: s.lessonsTotal,
									})}
								</p>
								{s.isComplete ? (
									<span className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-success px-3 py-1.5 font-medium text-sm text-white">
										<Trophy className="size-4" />
										{t("hub.complete", { defaultValue: "Complete!" })}
									</span>
								) : nextLesson ? (
									<Link
										to="/learn/lesson/$lessonId"
										params={{ lessonId: nextLesson.id }}
										className="mt-2 inline-flex items-center gap-2 rounded-btn bg-brand-primary px-4 py-2 font-semibold text-sm text-white transition-colors hover:bg-brand-primary-hover active:scale-[0.98]"
									>
										<PlayCircle className="size-4" />
										{s.lessonsDone > 0
											? t("hub.continue", { defaultValue: "Continue learning" })
											: t("hub.start", { defaultValue: "Start learning" })}
									</Link>
								) : null}
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* ── Curriculum + progress sidebar ────────────────────────────────── */}
			<div className="grid gap-6 lg:grid-cols-[1fr_300px]">
				<div className="space-y-4">
					{progress.modules.map((mod, mi) => (
						<section
							key={mod.id}
							className="overflow-hidden rounded-card border border-border bg-card shadow-card"
						>
							<h2 className="flex items-center gap-2.5 bg-muted px-4 py-3 font-display text-foreground">
								<span className="flex size-6 items-center justify-center rounded-full bg-brand-primary/10 font-stats font-bold text-brand-primary text-xs">
									{mi + 1}
								</span>
								{mod.title}
							</h2>
							<ul className="divide-y divide-slate-100">
								{mod.lessons.map((lesson) => (
									<li key={lesson.id}>
										<Link
											to="/learn/lesson/$lessonId"
											params={{ lessonId: lesson.id }}
											className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
										>
											{lesson.done ? (
												<CheckCircle2 className="size-5 shrink-0 text-success" />
											) : lesson.percent > 0 ? (
												<span className="relative flex size-5 shrink-0 items-center justify-center">
													<PlayCircle className="size-5 text-brand-primary" />
												</span>
											) : (
												<PlayCircle className="size-5 shrink-0 text-muted-foreground" />
											)}
											<span className="min-w-0 flex-1">
												<span className="block truncate text-foreground text-sm">
													{lesson.title}
												</span>
												{!lesson.done && lesson.percent > 0 ? (
													<span className="mt-1 flex h-1 w-full max-w-[12rem] overflow-hidden rounded-full bg-muted">
														<span
															className="h-full rounded-full bg-brand-primary"
															style={{ width: `${lesson.percent}%` }}
														/>
													</span>
												) : null}
											</span>
											{lesson.done ? (
												<span className="flex shrink-0 items-center gap-1 text-success text-xs">
													<CheckCircle2 className="size-3.5" />
													{t("hub.done", { defaultValue: "Done" })}
												</span>
											) : lesson.percent > 0 ? (
												<span className="shrink-0 font-stats font-semibold text-brand-primary text-xs">
													{lesson.percent}%
												</span>
											) : (
												<span className="flex shrink-0 items-center gap-1 font-medium text-brand-primary text-sm">
													<PlayCircle className="size-4" />
													{t("hub.open", { defaultValue: "Open" })}
												</span>
											)}
											<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
										</Link>
									</li>
								))}
							</ul>
							{mod.assessment ? (
								<EntryRow
									icon={ClipboardCheck}
									to="/learn/assessment/$assessmentId"
									params={{ assessmentId: mod.assessment.id }}
									label={t("hub.module_assessment", {
										defaultValue: "Module assessment",
									})}
									passed={mod.assessment.passed}
									action={t("hub.take", { defaultValue: "Take" })}
								/>
							) : null}
						</section>
					))}

					{/* Final assessment */}
					{progress.finalAssessment ? (
						<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
							<EntryRow
								icon={ClipboardCheck}
								to="/learn/assessment/$assessmentId"
								params={{ assessmentId: progress.finalAssessment.id }}
								label={t("hub.final_assessment", {
									defaultValue: "Final assessment",
								})}
								passed={progress.finalAssessment.passed}
								action={t("hub.take", { defaultValue: "Take" })}
							/>
						</section>
					) : null}

					{/* Projects */}
					{progress.projects.length > 0 ? (
						<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
							<h2 className="bg-muted px-4 py-3 font-display text-foreground">
								{t("hub.projects", { defaultValue: "Projects" })}
							</h2>
							<div className="divide-y divide-slate-100">
								{progress.projects.map((project) => (
									<EntryRow
										key={project.id}
										icon={FolderKanban}
										to="/learn/project/$projectId"
										params={{ projectId: project.id }}
										label={project.title}
										passed={project.passed}
										action={t("hub.open", { defaultValue: "Open" })}
									/>
								))}
							</div>
						</section>
					) : null}
				</div>

				<aside className="lg:self-start">
					<div className="space-y-4 lg:sticky lg:top-20">
						<div className="rounded-card border border-border bg-card p-5 shadow-card">
							<p className="font-display text-foreground">
								{t("hub.completion", { defaultValue: "Completion" })}
							</p>
							<div className="mt-3 space-y-2.5">
								<Gate
									ok={s.allLessonsDone}
									label={`${t("hub.gate_lessons", { defaultValue: "Lessons" })} ${s.lessonsDone}/${s.lessonsTotal}`}
								/>
								<Gate
									ok={s.allModuleAssessmentsPassed}
									label={t("hub.gate_modules", {
										defaultValue: "Module quizzes",
									})}
								/>
								<Gate
									ok={s.finalAssessmentPassed}
									label={t("hub.gate_final", {
										defaultValue: "Final assessment",
									})}
								/>
								<Gate
									ok={s.allProjectsPassed}
									label={t("hub.gate_projects", { defaultValue: "Projects" })}
								/>
							</div>
						</div>
						<div className="rounded-card border border-border bg-card p-5 shadow-card">
							<p className="font-display text-foreground">
								{t("hub.includes", { defaultValue: "What's included" })}
							</p>
							<div className="mt-3 space-y-2 text-muted-foreground text-sm">
								<p className="flex items-center gap-2">
									<Layers className="size-4 text-muted-foreground" />
									{t("hub.module_count", { count: moduleCount })}
								</p>
								<p className="flex items-center gap-2">
									<BookOpen className="size-4 text-muted-foreground" />
									{t("hub.lesson_count", { count: s.lessonsTotal })}
								</p>
							</div>
						</div>
					</div>
				</aside>
			</div>
		</div>
	);
}

function Gate({ ok, label }: { ok: boolean; label: string }) {
	return (
		<div className="flex items-center gap-2 text-sm">
			{ok ? (
				<CheckCircle2 className="size-4 shrink-0 text-success" />
			) : (
				<Circle className="size-4 shrink-0 text-muted-foreground" />
			)}
			<span className={ok ? "text-foreground" : "text-muted-foreground"}>
				{label}
			</span>
		</div>
	);
}

function EntryRow({
	icon: Icon,
	to,
	params,
	label,
	passed,
	action,
}: {
	icon: ComponentType<{ className?: string }>;
	to: string;
	params: Record<string, string>;
	label: string;
	passed: boolean;
	action: string;
}) {
	const { t } = useTranslation("authoring");
	return (
		<Link
			// biome-ignore lint/suspicious/noExplicitAny: typed route paths vary by entry.
			to={to as any}
			// biome-ignore lint/suspicious/noExplicitAny: param shape varies to match whichever route `to` resolves to.
			params={params as any}
			className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
		>
			<Icon className="size-5 shrink-0 text-brand-primary" />
			<span className="flex-1 font-medium text-foreground text-sm">
				{label}
			</span>
			{passed ? (
				<span className="flex items-center gap-1 text-success text-xs">
					<CheckCircle2 className="size-3.5" />
					{t("hub.passed", { defaultValue: "Passed" })}
				</span>
			) : (
				<span className="flex items-center gap-1 font-medium text-brand-primary text-sm">
					<PlayCircle className="size-4" />
					{action}
				</span>
			)}
			<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
		</Link>
	);
}
