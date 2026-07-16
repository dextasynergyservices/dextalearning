import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CheckCircle2,
	ChevronRight,
	ClipboardCheck,
	FolderKanban,
	Lock,
	MessagesSquare,
	PlayCircle,
	Trophy,
	Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { LearnerShell } from "@/components/layout/learner-shell";
import { CompletionCertificate } from "@/components/learn/completion-certificate";
import { ContentSearch } from "@/components/learn/content-search";
import { EarnBackStatus } from "@/components/learn/earn-back-status";
import { ProgressRing } from "@/components/learn/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { chatKeys, getMyGroupInCohort } from "@/lib/chat-api";
import { type CohortProgress, getCohortProgress } from "@/lib/content-api";
import { searchCohortContent } from "@/lib/search-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/cohort/$cohortId")({
	component: CohortProgressRoute,
});

function CohortProgressRoute() {
	const { cohortId } = Route.useParams();
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: ["cohort-progress", cohortId],
		queryFn: () => getCohortProgress(cohortId),
	});

	return (
		<LearnerShell
			title={
				data?.cohort.title ?? t("hub.cohort_title", { defaultValue: "Cohort" })
			}
		>
			<div className="mx-auto max-w-2xl space-y-5 px-4 py-6">
				{isPending || !data ? (
					<>
						<Skeleton className="h-28 rounded-card" />
						<Skeleton className="h-40 rounded-card" />
					</>
				) : (
					<>
						<MyGroupCard cohortId={cohortId} />
						<CompletionCertificate
							type="cohort"
							entityId={cohortId}
							title={data.cohort.title}
							isComplete={data.summary.isComplete}
						/>
						<EarnBackStatus type="cohort" entityId={cohortId} />
						{/* Semantic search across the cohort's courses (§4.10 RAG). */}
						<ContentSearch
							scopeId={cohortId}
							fetcher={(q) => searchCohortContent(cohortId, q)}
						/>
						<CohortBody data={data} />
					</>
				)}
			</div>
		</LearnerShell>
	);
}

/** A tappable "Your group" card that deep-links to the group's live chat. */
function MyGroupCard({ cohortId }: { cohortId: string }) {
	const { t } = useTranslation("chat");
	const { data } = useQuery({
		queryKey: chatKeys.myGroupInCohort(cohortId),
		queryFn: () => getMyGroupInCohort(cohortId),
	});
	if (!data) return null;
	return (
		<Link
			to="/learn/groups/$groupId"
			params={{ groupId: data.id }}
			className="flex items-center gap-3 rounded-card border border-brand-primary/25 bg-brand-primary-light/30 p-4 shadow-card transition-colors hover:border-brand-primary"
		>
			<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-primary text-white">
				<MessagesSquare className="size-5" />
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate font-display text-foreground text-sm">
					{t("your_group", { defaultValue: "Your group" })}
					{data.name ? ` · ${data.name}` : ""}
				</p>
				<p className="text-muted-foreground text-xs">
					{t("open_chat", {
						count: data.memberCount,
						defaultValue: "Open group chat · {{count}} members",
					})}
				</p>
			</div>
			<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
		</Link>
	);
}

function CohortBody({ data }: { data: CohortProgress }) {
	const { t } = useTranslation("authoring");
	const s = data.summary;
	const nextCourse = data.courses.find((c) => !c.isComplete);

	// Cohort assessments + projects are summative — they only open once every
	// course and path in the cohort is finished (§4.3). The server enforces it
	// too; this just stops the learner walking into a refusal.
	const coursesLeft = s.coursesTotal - s.coursesComplete;
	const pathsLeft = s.pathsTotal - s.pathsComplete;
	const finalsUnlocked = coursesLeft === 0 && pathsLeft === 0;
	const lockedNote =
		coursesLeft > 0
			? t("hub.locked_courses", {
					defaultValue_one: "Finish {{count}} more course to unlock this.",
					defaultValue_other: "Finish {{count}} more courses to unlock this.",
					count: coursesLeft,
				})
			: t("hub.locked_paths", {
					defaultValue_one: "Finish {{count}} more path to unlock this.",
					defaultValue_other: "Finish {{count}} more paths to unlock this.",
					count: pathsLeft,
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
							<Users className="size-3.5" />
							{t("hub.cohort_eyebrow", { defaultValue: "Cohort" })}
						</p>
						<h1 className="mt-1 font-display text-foreground text-xl leading-tight">
							{data.cohort.title}
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
						className="mt-4 flex items-center justify-center gap-2 rounded-btn bg-brand-primary py-2.5 font-semibold text-sm text-white transition-colors hover:bg-brand-primary-hover"
					>
						<PlayCircle className="size-4" />
						{t("hub.continue", { defaultValue: "Continue learning" })}
					</Link>
				) : null}
			</section>

			{data.courses.length > 0 ? (
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
													course.isComplete ? "bg-success" : "bg-brand-primary",
												)}
												style={{ width: `${course.percent}%` }}
											/>
										</span>
										<span className="font-stats text-muted-foreground text-xs">
											{course.percent}%
										</span>
									</span>
								</span>
								<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
							</Link>
						))}
					</div>
				</section>
			) : null}

			{data.paths.length > 0 ? (
				<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
					<h2 className="bg-muted px-4 py-3 font-display text-foreground">
						{t("hub.paths", { defaultValue: "Learning paths" })}
					</h2>
					<div className="divide-y divide-slate-100">
						{data.paths.map((path, i) => (
							<Link
								key={path.id}
								to="/learn/path/$pathId"
								params={{ pathId: path.id }}
								className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-accent"
							>
								{path.isComplete ? (
									<CheckCircle2 className="size-7 shrink-0 text-success" />
								) : (
									<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-accent/10 font-stats font-bold text-amber-700 text-xs dark:text-amber-300">
										{i + 1}
									</span>
								)}
								<span className="min-w-0 flex-1">
									<span className="block truncate font-medium text-foreground text-sm">
										{path.title}
									</span>
									<span className="mt-1.5 flex items-center gap-2">
										<span className="flex h-1.5 max-w-[10rem] flex-1 overflow-hidden rounded-full bg-muted">
											<span
												className={cn(
													"h-full rounded-full",
													path.isComplete ? "bg-success" : "bg-brand-primary",
												)}
												style={{ width: `${path.percent}%` }}
											/>
										</span>
										<span className="font-stats text-muted-foreground text-xs">
											{path.percent}%
										</span>
									</span>
								</span>
								<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
							</Link>
						))}
					</div>
				</section>
			) : null}

			{data.assessments.length > 0 ? (
				<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
					<h2 className="bg-muted px-4 py-3 font-display text-foreground">
						{t("hub.cohort_assessments", {
							defaultValue: "Cohort assessments",
						})}
					</h2>
					<div className="divide-y divide-slate-100">
						{data.assessments.map((a) => (
							<EntryRow
								key={a.id}
								icon={ClipboardCheck}
								to="/learn/assessment/$assessmentId"
								params={{ assessmentId: a.id }}
								label={
									a.title ?? t("hub.assessment", { defaultValue: "Assessment" })
								}
								passed={a.passed}
								action={t("hub.take", { defaultValue: "Take" })}
								locked={!finalsUnlocked && !a.passed}
								lockedNote={lockedNote}
							/>
						))}
					</div>
				</section>
			) : null}

			{data.projects.length > 0 ? (
				<section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
					<h2 className="bg-muted px-4 py-3 font-display text-foreground">
						{t("hub.projects", { defaultValue: "Projects" })}
					</h2>
					<div className="divide-y divide-slate-100">
						{data.projects.map((p) => (
							<EntryRow
								key={p.id}
								icon={FolderKanban}
								to="/learn/project/$projectId"
								params={{ projectId: p.id }}
								label={p.title}
								passed={p.passed}
								action={t("hub.open", { defaultValue: "Open" })}
								locked={!finalsUnlocked && !p.passed}
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
 * A row for a cohort assessment / project. When `locked` (§4.3) it is not a
 * link at all — the summative work only opens once every course and path in the
 * cohort is done — and it says *why* inline rather than failing on tap.
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
