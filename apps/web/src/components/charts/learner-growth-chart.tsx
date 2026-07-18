import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { getLearnerGrowth, trendKeys } from "@/lib/analytics-trends-api";
import { ChartCard, RangePicker } from "./chart-card";
import { useChartColors } from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

/**
 * Cumulative registered learners (admin) — "how big are we". One series, so
 * no legend box (the title names it); a soft gradient under the line gives
 * the area weight without hiding the grid. Cumulative curves only go up —
 * the slope is the story, and flat months show as exactly that.
 */
export function LearnerGrowthChart() {
	const { t, i18n } = useTranslation("authoring");
	const [months, setMonths] = useState(12);
	const colors = useChartColors();
	const reduceMotion = useReducedMotion();
	const gradientId = useId();
	const { data, isPending } = useQuery({
		queryKey: trendKeys.learnerGrowth(months),
		queryFn: () => getLearnerGrowth(months),
	});

	const monthLabel = useMemo(
		() => (ym: string) =>
			new Date(`${ym}-01T00:00:00Z`).toLocaleDateString(i18n.language, {
				month: "short",
				year: "2-digit",
				timeZone: "UTC",
			}),
		[i18n.language],
	);
	const seriesName = t("charts.series_learners_total", {
		defaultValue: "Registered learners",
	});

	return (
		<ChartCard
			title={t("charts.growth_title", { defaultValue: "Learner growth" })}
			subtitle={t("charts.growth_subtitle", {
				defaultValue: "Total registered learners over time (UTC months).",
			})}
			filters={
				<RangePicker
					value={months}
					onChange={setMonths}
					label={t("charts.range", { defaultValue: "Date range" })}
					options={[
						{ value: 6, label: t("charts.months_6", { defaultValue: "6m" }) },
						{
							value: 12,
							label: t("charts.months_12", { defaultValue: "12m" }),
						},
						{
							value: 24,
							label: t("charts.months_24", { defaultValue: "24m" }),
						},
					]}
				/>
			}
			table={
				data
					? {
							headers: [
								t("charts.col_month", { defaultValue: "Month" }),
								seriesName,
							],
							rows: data.map((p) => [monthLabel(p.month), p.total]),
						}
					: undefined
			}
		>
			{isPending || !data ? (
				<Skeleton className="h-64 w-full rounded-card" />
			) : (
				<div className="h-64 w-full" aria-hidden>
					<ResponsiveContainer width="100%" height="100%">
						<AreaChart
							data={data}
							margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
						>
							<defs>
								<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
									<stop
										offset="0%"
										stopColor={colors.categorical[0]}
										stopOpacity={0.28}
									/>
									<stop
										offset="100%"
										stopColor={colors.categorical[0]}
										stopOpacity={0.02}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid stroke={colors.grid} vertical={false} />
							<XAxis
								dataKey="month"
								tickFormatter={monthLabel}
								tick={{ fill: colors.axis, fontSize: 11 }}
								tickLine={false}
								axisLine={{ stroke: colors.grid }}
								minTickGap={24}
							/>
							<YAxis
								allowDecimals={false}
								tick={{ fill: colors.axis, fontSize: 11 }}
								tickLine={false}
								axisLine={false}
								width={40}
							/>
							<Tooltip
								content={<ChartTooltip />}
								labelFormatter={(v) => monthLabel(String(v))}
								cursor={{ stroke: colors.axis, strokeDasharray: "3 3" }}
							/>
							<Area
								type="monotone"
								dataKey="total"
								name={seriesName}
								stroke={colors.categorical[0]}
								strokeWidth={2}
								fill={`url(#${gradientId})`}
								activeDot={{ r: 4, strokeWidth: 2 }}
								isAnimationActive={!reduceMotion}
								animationDuration={700}
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
			)}
		</ChartCard>
	);
}

export default LearnerGrowthChart;
