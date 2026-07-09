import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GradeSubmissionDialog } from "@/components/authoring/grade-submission-dialog";
import { StudioShell } from "@/components/authoring/studio-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listProjectSubmissions, type SubmissionRow } from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
	"/instructor/project-submissions/$projectId",
)({ component: InstructorSubmissionsRoute });

function InstructorSubmissionsRoute() {
	const { projectId } = Route.useParams();
	return <SubmissionsQueuePage projectId={projectId} area="instructor" />;
}

export function SubmissionsQueuePage({
	projectId,
	area = "instructor",
}: {
	projectId: string;
	area?: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const [openId, setOpenId] = useState<string | null>(null);

	const { data, isPending, isError, error } = useQuery({
		queryKey: ["project-submissions", projectId],
		queryFn: () => listProjectSubmissions(projectId),
	});
	const rows = data ?? [];
	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: ["project-submissions", projectId],
		});

	return (
		<StudioShell
			title={t("grade.queue_title", { defaultValue: "Submissions" })}
			area={area}
		>
			{isPending ? (
				<div className="space-y-3">
					<Skeleton className="h-16 rounded-card" />
					<Skeleton className="h-16 rounded-card" />
				</div>
			) : isError ? (
				<div className="rounded-card border border-error/30 bg-error/5 p-5 text-error">
					<p className="font-semibold">
						{t("grade.queue_load_failed", {
							defaultValue: "Submissions could not be loaded",
						})}
					</p>
					<p className="mt-1 text-sm">
						{error instanceof Error
							? error.message
							: t("grade.queue_load_failed_body", {
									defaultValue: "Refresh the page or go back and try again.",
								})}
					</p>
				</div>
			) : rows.length === 0 ? (
				<EmptyState
					title={t("grade.no_subs", { defaultValue: "No submissions yet." })}
				/>
			) : (
				<ul className="space-y-2">
					{rows.map((row) => (
						<SubmissionRowItem
							key={row.id}
							row={row}
							onOpen={() => setOpenId(row.id)}
						/>
					))}
				</ul>
			)}

			{openId ? (
				<GradeSubmissionDialog
					submissionId={openId}
					onClose={() => setOpenId(null)}
					onGraded={refresh}
				/>
			) : null}
		</StudioShell>
	);
}

function SubmissionRowItem({
	row,
	onOpen,
}: {
	row: SubmissionRow;
	onOpen: () => void;
}) {
	const { t } = useTranslation("authoring");
	return (
		<li>
			<button
				type="button"
				onClick={onOpen}
				className="flex w-full items-center gap-3 rounded-card border border-border bg-card p-3.5 text-left shadow-card transition-colors hover:border-brand-primary/40 sm:p-4"
			>
				<span
					className={cn(
						"flex size-10 shrink-0 items-center justify-center rounded-btn",
						!row.graded
							? "bg-warning/15 text-amber-600 dark:text-amber-400"
							: row.passed
								? "bg-success/10 text-success"
								: "bg-error/10 text-error",
					)}
				>
					{!row.graded ? (
						<Clock className="size-5" />
					) : row.passed ? (
						<CheckCircle2 className="size-5" />
					) : (
						<XCircle className="size-5" />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-foreground text-sm">
						{row.userName ||
							row.userEmail ||
							t("grade.learner", { defaultValue: "Learner" })}
					</p>
					<p className="text-muted-foreground text-xs">
						{row.graded
							? t("grade.graded_score", {
									defaultValue: "Graded · {{n}}%",
									n: row.score ?? 0,
								})
							: t("grade.awaiting", { defaultValue: "Awaiting grade" })}
						{row.submittedAt
							? ` · ${new Date(row.submittedAt).toLocaleDateString()}`
							: ""}
					</p>
				</div>
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
			</button>
		</li>
	);
}
