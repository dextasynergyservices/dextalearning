import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import {
	getEarnBackOutcomes,
	getOutcomeDistribution,
	getRevenueByType,
	trendKeys,
} from "@/lib/analytics-trends-api";
import { formatMoney } from "@/lib/earnings-api";
import { ChartCard } from "./chart-card";
import { DonutChart } from "./donut-chart";

/**
 * The composition ("share of what") cards — each one question, one donut,
 * slices in fixed palette order. All three reconcile with their source
 * numbers by construction: outcome slices re-sum to enrolments, Earn-Back
 * slices to resolved sales, revenue slices to settled gross.
 */

export function OutcomeDonutCard() {
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: trendKeys.outcomes,
		queryFn: getOutcomeDistribution,
	});

	const slices = data
		? [
				{
					key: "completed",
					label: t("charts.stage_completed", { defaultValue: "Completed" }),
					value: data.completed,
				},
				{
					key: "inProgress",
					label: t("charts.slice_in_progress", { defaultValue: "In progress" }),
					value: data.inProgress,
				},
				{
					key: "notStarted",
					label: t("charts.slice_not_started", { defaultValue: "Not started" }),
					value: data.notStarted,
				},
			]
		: [];
	const total = slices.reduce((s, x) => s + x.value, 0);

	return (
		<ChartCard
			title={t("charts.outcomes_title", { defaultValue: "Learner outcomes" })}
			subtitle={t("charts.outcomes_subtitle", {
				defaultValue: "Everyone enrolled in your content, by where they are.",
			})}
			table={
				data
					? {
							headers: [
								t("charts.col_stage", { defaultValue: "Stage" }),
								t("charts.col_learners", { defaultValue: "Learners" }),
							],
							rows: slices.map((s) => [s.label, s.value]),
						}
					: undefined
			}
		>
			{isPending || !data ? (
				<Skeleton className="h-44 w-full rounded-card" />
			) : total === 0 ? (
				<Empty
					text={t("charts.outcomes_empty", {
						defaultValue: "No enrolments yet.",
					})}
				/>
			) : (
				<DonutChart
					slices={slices}
					totalLabel={t("charts.outcomes_total", {
						defaultValue: "enrolments",
					})}
				/>
			)}
		</ChartCard>
	);
}

export function EarnBackOutcomesCard() {
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: trendKeys.earnBackOutcomes,
		queryFn: getEarnBackOutcomes,
	});

	const slices = data
		? [
				{
					key: "onTime",
					label: t("charts.slice_on_time", {
						defaultValue: "Finished on time",
					}),
					value: data.onTime,
				},
				{
					key: "late",
					label: t("charts.slice_late", { defaultValue: "Finished late" }),
					value: data.late,
				},
				{
					key: "missed",
					label: t("charts.slice_missed", { defaultValue: "Never finished" }),
					value: data.missed,
				},
			]
		: [];
	const total = slices.reduce((s, x) => s + x.value, 0);

	return (
		<ChartCard
			title={t("charts.earnback_title", { defaultValue: "Earn-Back outcomes" })}
			subtitle={t("charts.earnback_subtitle", {
				defaultValue:
					"Resolved Earn-Back sales. On time means the learner won — that's the deal working.",
			})}
			table={
				data
					? {
							headers: [
								t("charts.col_outcome", { defaultValue: "Outcome" }),
								t("charts.col_sales", { defaultValue: "Sales" }),
							],
							rows: slices.map((s) => [s.label, s.value]),
						}
					: undefined
			}
		>
			{isPending || !data ? (
				<Skeleton className="h-44 w-full rounded-card" />
			) : total === 0 ? (
				<Empty
					text={t("charts.earnback_empty", {
						defaultValue: "No resolved Earn-Back sales yet.",
					})}
				/>
			) : (
				<DonutChart
					slices={slices}
					totalLabel={t("charts.earnback_total", {
						defaultValue: "resolved sales",
					})}
				/>
			)}
		</ChartCard>
	);
}

export function RevenueByTypeCard() {
	const { t } = useTranslation("authoring");
	const { data, isPending } = useQuery({
		queryKey: trendKeys.revenueByType,
		queryFn: getRevenueByType,
	});
	const money = (n: number) => formatMoney(n, "NGN");

	const typeLabel: Record<string, string> = {
		course: t("charts.series_courses", { defaultValue: "Courses" }),
		path: t("charts.series_paths", { defaultValue: "Paths" }),
		cohort: t("charts.series_cohorts", { defaultValue: "Cohorts" }),
	};
	const slices = (data ?? []).map((r) => ({
		key: r.entityType,
		label: typeLabel[r.entityType] ?? r.entityType,
		value: r.gross,
	}));
	const total = slices.reduce((s, x) => s + x.value, 0);

	return (
		<ChartCard
			title={t("charts.revenue_by_type_title", {
				defaultValue: "Revenue by content type",
			})}
			subtitle={t("charts.revenue_by_type_subtitle", {
				defaultValue: "Gross settled revenue, by what was sold.",
			})}
			table={
				data
					? {
							headers: [
								t("charts.col_type", { defaultValue: "Type" }),
								t("charts.col_gross", { defaultValue: "Gross" }),
							],
							rows: slices.map((s) => [s.label, money(s.value)]),
						}
					: undefined
			}
		>
			{isPending || !data ? (
				<Skeleton className="h-44 w-full rounded-card" />
			) : total === 0 ? (
				<Empty
					text={t("charts.revenue_by_type_empty", {
						defaultValue: "No settled sales yet.",
					})}
				/>
			) : (
				<DonutChart
					slices={slices}
					format={money}
					totalLabel={t("charts.col_gross", { defaultValue: "Gross" })}
				/>
			)}
		</ChartCard>
	);
}

function Empty({ text }: { text: string }) {
	return (
		<p className="py-8 text-center text-muted-foreground text-sm">{text}</p>
	);
}
