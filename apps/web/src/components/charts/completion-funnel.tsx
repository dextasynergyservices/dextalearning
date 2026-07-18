import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type FunnelStage,
	getCompletionFunnel,
	trendKeys,
} from "@/lib/analytics-trends-api";
import { ChartCard } from "./chart-card";
import { useChartColors } from "./chart-theme";

/**
 * Enrolled → started → completed (§15). Ordered stages of one magnitude =
 * horizontal bars in a SEQUENTIAL single hue (light→dark of the brand blue),
 * not three categorical colors — the stages are one thing progressively
 * filtered, not three identities. Plain HTML on purpose: three bars don't
 * justify shipping a charting library, and direct labels beat a tooltip here.
 */
export function CompletionFunnel({
	entityType,
	entityId,
}: {
	entityType: "course" | "path" | "cohort";
	entityId: string;
}) {
	const { t } = useTranslation("authoring");
	const colors = useChartColors();
	const { data, isPending } = useQuery({
		queryKey: trendKeys.funnel(entityType, entityId),
		queryFn: () => getCompletionFunnel(entityType, entityId),
	});

	const stageName: Record<FunnelStage["key"], string> = {
		enrolled: t("charts.stage_enrolled", { defaultValue: "Enrolled" }),
		started: t("charts.stage_started", { defaultValue: "Started" }),
		completed: t("charts.stage_completed", { defaultValue: "Completed" }),
	};

	const stages = data?.stages ?? [];
	const max = stages[0]?.count ?? 0;
	// Sequential steps: skip the lightest (axis-adjacent) step for contrast.
	const stageColor = [
		colors.sequential[1],
		colors.sequential[2],
		colors.sequential[3],
	];

	return (
		<ChartCard
			title={t("charts.funnel_title", { defaultValue: "Completion funnel" })}
			subtitle={t("charts.funnel_subtitle", {
				defaultValue: "Of everyone enrolled, who started — and who finished.",
			})}
			table={
				data
					? {
							headers: [
								t("charts.col_stage", { defaultValue: "Stage" }),
								t("charts.col_learners", { defaultValue: "Learners" }),
							],
							rows: stages.map((s) => [stageName[s.key], s.count]),
						}
					: undefined
			}
		>
			{isPending || !data ? (
				<Skeleton className="h-40 w-full rounded-card" />
			) : max === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					{t("charts.funnel_empty", {
						defaultValue: "No enrolments yet — the funnel starts with one.",
					})}
				</p>
			) : (
				<ol className="space-y-3">
					{stages.map((stage, i) => {
						const prev = i === 0 ? stage.count : stages[i - 1].count;
						const ofPrev =
							prev > 0 ? Math.round((stage.count / prev) * 100) : 0;
						return (
							<li key={stage.key}>
								<div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
									<span className="font-medium text-foreground">
										{stageName[stage.key]}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										<span className="font-semibold text-foreground">
											{stage.count}
										</span>
										{i > 0
											? ` · ${t("charts.of_previous", {
													defaultValue: "{{pct}}% of previous",
													pct: ofPrev,
												})}`
											: ""}
									</span>
								</div>
								<div className="h-7 overflow-hidden rounded-[4px] bg-muted">
									<div
										role="presentation"
										className="h-full rounded-[4px] transition-[width] duration-300 motion-reduce:transition-none"
										style={{
											width: `${max > 0 ? Math.max(stage.count > 0 ? 2 : 0, (stage.count / max) * 100) : 0}%`,
											backgroundColor: stageColor[i],
										}}
									/>
								</div>
							</li>
						);
					})}
				</ol>
			)}
		</ChartCard>
	);
}

export default CompletionFunnel;
