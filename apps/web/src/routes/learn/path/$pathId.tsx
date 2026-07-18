import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CheckCircle2,
	ChevronRight,
	ClipboardCheck,
	FolderKanban,
	Lock,
	PlayCircle,
	Trophy,
	Waypoints,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LearnerShell } from "@/components/layout/learner-shell";
import { CompletionCertificate } from "@/components/learn/completion-certificate";
import { ContentSearch } from "@/components/learn/content-search";
import { EarnBackStatus } from "@/components/learn/earn-back-status";
import { ProgressRing } from "@/components/learn/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { getPathProgress, type PathProgress } from "@/lib/content-api";
import { searchPathContent } from "@/lib/search-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/path/$pathId")({
	component: PathProgressRoute,
});

function PathProgressRoute() {
	const { pathId } = Route.useParams();
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: ["path-progress", pathId],
		queryFn: () => getPathProgress(pathId),
	});

	return (
		<LearnerShell
			title={data?.path.title ?? t("hub.path_title", { defaultValue: "Path" })}
		>
			<div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
				{isPending || !data ? (
					<>
						<Skeleton className="h-28 rounded-card" />
						<Skeleton className="h-40 rounded-card" />
					</>
				) : (
					<PathBody data={data} />
				)}
			</div>
		</LearnerShell>
	);
}

function PathBody({ data }: { data: PathProgress }) {
	const { t } = useTranslation("authoring");
	const s = data.summary;
	const nextCourse = data.courses.find((c) => !c.isComplete);

	// The path's final + projects are summative — they open once its courses are
	// done (§4.3.1). The server enforces this too; this just stops the learner
	// walking into a refusal.
	const finalsUnlocked = s.allCoursesComplete;
	const coursesLeft = s.coursesTotal - s.coursesComplete;
	const lockedNote = t("hub.locked_path_courses", {
		defaultValue_one:
			"Finish {{count}} more course in this path to unlock this.",
		defaultValue_other:
			"Finish {{count}} more courses in this path to unlock this.",
		count: coursesLeft,
	});

	return (
		<>
			<section
				className={cn(
					"rounded-card border p-5 shadow-card",
					s.isComplete
						? "border-success/30 bg-success/5"
						: "border-border bg-card",
				)}
			>
				<div className="flex items-center gap-4">
					<ProgressRing value={s.percent} complete={s.isComplete} size={76} />
					<div className="min-w-0 flex-1">
						<p className="flex items-center gap-1.5 font-stats font-semibold text-brand-primary text-xs uppercase">
							<Waypoints className="size-3.5" />
							{t("hub.path_eyebrow", { defaultValue: "Learning path" })}
						</p>
						<h1 className="mt-1 font-display text-foreground text-xl leading-tight">
							{data.path.title}
						</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							{t("hub.path_progress", {
								defaultValue: "{{done}}/{{total}} courses complete",
								done: s.coursesComplete,
								total: s.coursesTotal,
								n: s.percent,
							})}
						</p>
					</div>
				</div>

				{s.isComplete ? (
					<div className="mt-4 flex items-center justify-center gap-1.5 rounded-btn bg-success py-2.5 font-medium text-sm text-white">
						<Trophy className="size-4" />
						{t("hub.complete", { defaultValue: "Complete!" })}
					</div>
				) : nextCourse ? (
					<Link
						to="/learn/course/$courseId"
						params={{ courseId: nextCourse.id }}
						className="mt-4 flex items-center justify-center gap-2 rounded-btn bg-brand-solid py-2.5 font-semibold text-sm text-white transition-colors hover:bg-brand-solid-hover"
					>
						<PlayCircle className="size-4" />
						{t("hub.continue", { defaultValue: "Continue learning" })}
					</Link>
				) : null}
			</section>

			<CompletionCertificate
				type="path"
				entityId={data.path.id}
				title={data.path.title}
				isComplete={s.isComplete}
			/>

			<EarnBackStatus type="path" entityId={data.path.id} />

			{/* Semantic search across every course in this path (§4.10 RAG). */}
			<ContentSearch
				scopeId={data.path.id}
				fetcher={(q) => searchPathContent(data.path.id, q)}
			/>

			<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
				<h2 className="bg-muted px-4 py-3 font-display text-foreground">
					{t("hub.courses", { defaultValue: "Courses" })}
				</h2>
				<div className="divide-y divide-slate-100">
					{data.courses.map((course, i) => (
						<Link
							key={course.id}
							to="/learn/course/$courseId"
							params={{ courseId: course.id }}
							className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent"
						>
							{course.isComplete ? (
								<CheckCircle2 className="size-7 shrink-0 text-success" />
							) : (
								<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 font-stats font-bold text-brand-primary text-xs">
									{i + 1}
								</span>
							)}
							<span className="min-w-0 flex-1">
								<span className="block truncate font-medium text-foreground text-sm">
									{course.title}
								</span>
								<span className="mt-1.5 flex items-center gap-2">
									<span className="flex h-1.5 max-w-[10rem] flex-1 overflow-hidden rounded-full bg-muted">
										<span
											className={cn(
												"h-full rounded-full",
												course.isComplete ? "bg-success" : "bg-brand-solid",
											)}
											style={{ width: `${course.percent}%` }}
										/>
									</span>
									<span className="font-stats text-muted-foreground text-xs">
										{course.percent}%
									</span>
									{!course.isRequired ? (
										<span className="text-muted-foreground text-xs">
											· {t("hub.optional", { defaultValue: "Optional" })}
										</span>
									) : null}
								</span>
							</span>
							<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
						</Link>
					))}
				</div>
			</section>

			{/* The path's own final — locked until its courses are done (§4.3.1) */}
			{data.finalAssessment ? (
				<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
					<EntryRow
						icon={ClipboardCheck}
						to="/learn/assessment/$assessmentId"
						params={{ assessmentId: data.finalAssessment.id }}
						label={t("hub.path_final_assessment", {
							defaultValue: "Path final assessment",
						})}
						passed={data.finalAssessment.passed}
						action={t("hub.take", { defaultValue: "Take" })}
						locked={!finalsUnlocked && !data.finalAssessment.passed}
						lockedNote={lockedNote}
					/>
				</section>
			) : null}

			{data.projects.length > 0 ? (
				<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
					<h2 className="bg-muted px-4 py-3 font-display text-foreground">
						{t("hub.projects", { defaultValue: "Projects" })}
					</h2>
					<div className="divide-y divide-slate-100">
						{data.projects.map((project) => (
							<EntryRow
								key={project.id}
								icon={FolderKanban}
								to="/learn/project/$projectId"
								params={{ projectId: project.id }}
								label={project.title}
								passed={project.passed}
								action={t("hub.open", { defaultValue: "Open" })}
								locked={!finalsUnlocked && !project.passed}
								lockedNote={lockedNote}
							/>
						))}
					</div>
				</section>
			) : null}
		</>
	);
}

/**
 * A row for the path's final assessment / project. When `locked` (§4.3.1) it is
 * not a link at all — the summative work only opens once the path's courses are
 * done — and it says *why* inline rather than failing on tap.
 */
function EntryRow({
	icon: Icon,
	to,
	params,
	label,
	passed,
	action,
	locked,
	lockedNote,
}: {
	icon: typeof ClipboardCheck;
	to: string;
	params: Record<string, string>;
	label: string;
	passed: boolean;
	action: string;
	locked?: boolean;
	lockedNote?: string;
}) {
	const { t } = useTranslation("authoring");

	if (locked) {
		return (
			<div
				aria-disabled="true"
				className="flex items-start gap-3 px-4 py-3 opacity-80"
			>
				<Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1">
					<span className="block truncate font-medium text-muted-foreground text-sm">
						{label}
					</span>
					{lockedNote ? (
						<span className="mt-0.5 block text-muted-foreground text-xs">
							{lockedNote}
						</span>
					) : null}
				</span>
				<span className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
					<Lock className="size-3.5" />
					{t("hub.locked", { defaultValue: "Locked" })}
				</span>
			</div>
		);
	}

	return (
		<Link
			// biome-ignore lint/suspicious/noExplicitAny: typed route paths vary by entry.
			to={to as any}
			// biome-ignore lint/suspicious/noExplicitAny: param shape varies to match whichever route `to` resolves to.
			params={params as any}
			className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
		>
			<Icon className="size-5 shrink-0 text-brand-primary" />
			<span className="flex-1 truncate font-medium text-foreground text-sm">
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
