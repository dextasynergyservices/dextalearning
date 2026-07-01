import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Ban, ChevronRight, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AttemptReportDialog } from "@/components/authoring/attempt-report-dialog";
import { StudioShell } from "@/components/authoring/studio-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type AttemptSummaryRow,
	listAssessmentAttempts,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
	"/instructor/attempt-reports/$assessmentId",
)({ component: InstructorAttemptReportsRoute });

function InstructorAttemptReportsRoute() {
	const { assessmentId } = Route.useParams();
	return <AttemptsReportPage assessmentId={assessmentId} area="instructor" />;
}

export function integrityTone(score: number) {
	if (score >= 85) return "bg-success/10 text-success";
	if (score >= 60) return "bg-amber-100 text-amber-700";
	return "bg-error/10 text-error";
}

export function AttemptsReportPage({
	assessmentId,
	area = "instructor",
}: {
	assessmentId: string;
	area?: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();
	const [openId, setOpenId] = useState<string | null>(null);

	const { data, isPending } = useQuery({
		queryKey: ["assessment-attempts", assessmentId],
		queryFn: () => listAssessmentAttempts(assessmentId),
	});
	const rows = data ?? [];

	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: ["assessment-attempts", assessmentId],
		});

	return (
		<StudioShell
			title={t("report.attempts_title", {
				defaultValue: "Attempts & integrity",
			})}
			area={area}
		>
			{isPending ? (
				<div className="space-y-3">
					<Skeleton className="h-16 rounded-card" />
					<Skeleton className="h-16 rounded-card" />
				</div>
			) : rows.length === 0 ? (
				<EmptyState
					title={t("report.no_attempts", {
						defaultValue: "No one has taken this assessment yet.",
					})}
				/>
			) : (
				<ul className="space-y-2">
					{rows.map((row) => (
						<AttemptRow
							key={row.id}
							row={row}
							onOpen={() => setOpenId(row.id)}
						/>
					))}
				</ul>
			)}

			{openId ? (
				<AttemptReportDialog
					attemptId={openId}
					onClose={() => setOpenId(null)}
					onChanged={refresh}
				/>
			) : null}
		</StudioShell>
	);
}

function AttemptRow({
	row,
	onOpen,
}: {
	row: AttemptSummaryRow;
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
						"flex size-12 shrink-0 flex-col items-center justify-center rounded-btn font-stats font-bold",
						integrityTone(row.integrityScore),
					)}
				>
					{row.integrityScore}
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-foreground text-sm">
						{row.userName ||
							row.userEmail ||
							t("report.learner", { defaultValue: "Learner" })}
					</p>
					<p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
						<span>
							{row.score == null ? "—" : `${row.score}%`}
							{" · "}
							{row.passed
								? t("report.passed", { defaultValue: "Passed" })
								: t("report.failed", { defaultValue: "Failed" })}
						</span>
						{row.flagCount > 0 ? (
							<span className="text-amber-600">
								{t("report.flag_count", {
									defaultValue: "{{n}} flags",
									n: row.flagCount,
								})}
							</span>
						) : null}
						{row.invalidated ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-1.5 py-0.5 text-error">
								<Ban className="size-3" />
								{t("report.invalid_chip", { defaultValue: "Invalid" })}
							</span>
						) : null}
						{row.escalated ? (
							<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700">
								<ShieldAlert className="size-3" />
								{t("report.escalated_chip", { defaultValue: "Escalated" })}
							</span>
						) : null}
					</p>
				</div>
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
			</button>
		</li>
	);
}
