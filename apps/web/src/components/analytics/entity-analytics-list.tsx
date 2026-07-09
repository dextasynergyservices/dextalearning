import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AnalyticsTable } from "@/components/analytics/analytics-table";
import { CompletionBar } from "@/components/analytics/completion-bar";
import type { EntityAnalyticsRow } from "@/lib/analytics-api";

/**
 * Course/path/cohort analytics as a responsive, sortable, paginated list.
 * `onOpen(row)` navigates to that entity's detail page.
 */
export function EntityAnalyticsList({
	rows,
	entityLabel,
	showInstructor = false,
	onOpen,
}: {
	rows: EntityAnalyticsRow[];
	entityLabel: string;
	showInstructor?: boolean;
	onOpen: (row: EntityAnalyticsRow) => void;
}) {
	const { t } = useTranslation("authoring");

	const columns = useMemo<ColumnDef<EntityAnalyticsRow>[]>(() => {
		const defs: ColumnDef<EntityAnalyticsRow>[] = [
			{
				id: "title",
				accessorKey: "title",
				header: entityLabel,
				cell: ({ row }) => (
					<div className="min-w-40 max-w-64">
						<p className="truncate font-medium text-foreground">
							{row.original.title}
						</p>
						<span className={row.original.live ? "badge-open" : "badge-soon"}>
							{row.original.live
								? t("analytics.live")
								: t("analytics.not_live")}
						</span>
					</div>
				),
			},
		];
		if (showInstructor) {
			defs.push({
				id: "instructorName",
				accessorFn: (row) => row.instructorName ?? "",
				header: t("analytics.instructor"),
				cell: ({ row }) => (
					<span className="whitespace-nowrap text-muted-foreground">
						{row.original.instructorName ?? "—"}
					</span>
				),
			});
		}
		defs.push(
			{
				id: "enrolled",
				accessorKey: "enrolled",
				header: t("analytics.enrolled"),
			},
			{
				id: "completed",
				accessorKey: "completed",
				header: t("analytics.completions"),
			},
			{
				id: "inProgress",
				accessorKey: "inProgress",
				header: t("analytics.in_progress"),
			},
			{
				id: "notStarted",
				accessorKey: "notStarted",
				header: t("analytics.not_started"),
			},
			{
				id: "completionRate",
				accessorKey: "completionRate",
				header: t("analytics.completion_rate"),
				cell: ({ row }) => (
					<CompletionBar
						value={row.original.completionRate}
						className="min-w-28"
					/>
				),
			},
			{
				id: "avgProgressPct",
				accessorKey: "avgProgressPct",
				header: t("analytics.avg_progress"),
				cell: ({ row }) => (
					<span className="font-stats text-foreground">
						{row.original.avgProgressPct}%
					</span>
				),
			},
			{
				id: "chevron",
				enableSorting: false,
				header: "",
				cell: () => <ChevronRight className="size-4 text-muted-foreground" />,
			},
		);
		return defs;
	}, [t, entityLabel, showInstructor]);

	const sortOptions = useMemo(
		() => [
			{ id: "enrolled", label: t("analytics.enrolled") },
			{ id: "completed", label: t("analytics.completions") },
			{ id: "completionRate", label: t("analytics.completion_rate") },
			{ id: "avgProgressPct", label: t("analytics.avg_progress") },
		],
		[t],
	);

	return (
		<AnalyticsTable
			testId="entity-analytics-list"
			data={rows}
			columns={columns}
			initialSort={[{ id: "enrolled", desc: true }]}
			sortOptions={sortOptions}
			onRowClick={onOpen}
			emptyLabel={t("analytics.table_empty")}
			renderCard={(row, open) => (
				<button
					type="button"
					onClick={open}
					className="flex w-full items-center gap-3 rounded-card border border-border bg-card p-4 text-left shadow-card transition-colors hover:border-brand-primary/30"
				>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<p className="truncate font-medium text-foreground">
								{row.title}
							</p>
							<span className={row.live ? "badge-open" : "badge-soon"}>
								{row.live ? t("analytics.live") : t("analytics.not_live")}
							</span>
						</div>
						{showInstructor && row.instructorName ? (
							<p className="mt-0.5 truncate text-muted-foreground text-xs">
								{row.instructorName}
							</p>
						) : null}
						<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
							<span>
								{t("analytics.enrolled")}:{" "}
								<span className="font-stats font-semibold text-foreground">
									{row.enrolled}
								</span>
							</span>
							<span>
								{t("analytics.completions")}:{" "}
								<span className="font-stats font-semibold text-foreground">
									{row.completed}
								</span>
							</span>
							<span>
								{t("analytics.in_progress")}:{" "}
								<span className="font-stats font-semibold text-foreground">
									{row.inProgress}
								</span>
							</span>
						</div>
						<CompletionBar value={row.completionRate} className="mt-2.5" />
					</div>
					<ChevronRight className="size-5 shrink-0 text-muted-foreground" />
				</button>
			)}
		/>
	);
}
