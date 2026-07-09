import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AnalyticsTable } from "@/components/analytics/analytics-table";
import { CompletionBar } from "@/components/analytics/completion-bar";
import type { EntityLearner } from "@/lib/analytics-api";

function initialsOf(name: string): string {
	return (
		name
			.split(" ")
			.filter(Boolean)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

/**
 * Enrolled learners for one entity, as a responsive sortable paginated list.
 * `onOpen(learner)` opens that learner's per-student performance modal.
 */
export function LearnerAnalyticsList({
	learners,
	onOpen,
}: {
	learners: EntityLearner[];
	onOpen: (learner: EntityLearner) => void;
}) {
	const { t, i18n } = useTranslation("authoring");
	const dateFormat = useMemo(
		() =>
			new Intl.DateTimeFormat(i18n.language, {
				day: "numeric",
				month: "short",
				year: "numeric",
			}),
		[i18n.language],
	);

	const columns = useMemo<ColumnDef<EntityLearner>[]>(
		() => [
			{
				id: "name",
				accessorKey: "name",
				header: t("analytics.learner"),
				cell: ({ row }) => (
					<div className="flex min-w-40 items-center gap-2.5">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-primary-light font-stats font-semibold text-brand-primary text-xs">
							{initialsOf(row.original.name)}
						</span>
						<span className="truncate font-medium text-foreground">
							{row.original.name}
						</span>
					</div>
				),
			},
			{
				id: "progressPercent",
				accessorKey: "progressPercent",
				header: t("analytics.progress"),
				cell: ({ row }) => (
					<CompletionBar
						value={row.original.progressPercent}
						tone={row.original.isComplete ? "success" : "primary"}
						className="min-w-28"
					/>
				),
			},
			{
				id: "status",
				accessorFn: (row) => (row.isComplete ? 1 : 0),
				header: t("analytics.status"),
				cell: ({ row }) =>
					row.original.isComplete ? (
						<span className="inline-flex items-center gap-1 font-medium text-success text-xs">
							<CheckCircle2 className="size-3.5" />
							{t("analytics.completed_state")}
						</span>
					) : (
						<span className="text-muted-foreground text-xs">
							{t("analytics.in_progress")}
						</span>
					),
			},
			{
				id: "enrolledAt",
				accessorKey: "enrolledAt",
				header: t("analytics.enrolled_on"),
				cell: ({ row }) => (
					<span className="whitespace-nowrap text-muted-foreground">
						{dateFormat.format(new Date(row.original.enrolledAt))}
					</span>
				),
			},
			{
				id: "chevron",
				enableSorting: false,
				header: "",
				cell: () => <ChevronRight className="size-4 text-muted-foreground" />,
			},
		],
		[t, dateFormat],
	);

	const sortOptions = useMemo(
		() => [
			{ id: "progressPercent", label: t("analytics.progress") },
			{ id: "name", label: t("analytics.learner") },
			{ id: "enrolledAt", label: t("analytics.enrolled_on") },
		],
		[t],
	);

	return (
		<AnalyticsTable
			testId="learner-analytics-list"
			data={learners}
			columns={columns}
			initialSort={[{ id: "progressPercent", desc: true }]}
			sortOptions={sortOptions}
			onRowClick={onOpen}
			emptyLabel={t("analytics.no_learners")}
			renderCard={(learner, open) => (
				<button
					type="button"
					onClick={open}
					className="flex w-full items-center gap-3 rounded-card border border-border bg-card p-3.5 text-left shadow-card transition-colors hover:border-brand-primary/30"
				>
					<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-primary-light font-stats font-semibold text-brand-primary text-sm">
						{initialsOf(learner.name)}
					</span>
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium text-foreground text-sm">
							{learner.name}
						</p>
						<CompletionBar
							value={learner.progressPercent}
							tone={learner.isComplete ? "success" : "primary"}
							className="mt-1.5"
						/>
					</div>
					{learner.isComplete ? (
						<CheckCircle2 className="size-5 shrink-0 text-success" />
					) : (
						<ChevronRight className="size-5 shrink-0 text-muted-foreground" />
					)}
				</button>
			)}
		/>
	);
}
