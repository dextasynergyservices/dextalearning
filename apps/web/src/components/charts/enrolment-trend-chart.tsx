import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { getEnrolmentTrend, trendKeys } from "@/lib/analytics-trends-api";
import { ChartCard, RangePicker } from "./chart-card";
import { useChartColors } from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

/**
 * Daily enrolments into the instructor's content (§15) — change-over-time,
 * so a line chart. Three series max (courses/paths/cohorts) in FIXED
 * categorical order 1→3: a filter or an empty series never repaints the
 * others. 2px lines, no standing dots (the hover marker is the dot), legend
 * always on for ≥2 series, crosshair tooltip.
 */
export function EnrolmentTrendChart() {
	const { t, i18n } = useTranslation("authoring");
	const [days, setDays] = useState(90);
	// Legend-click hides/shows a series — the classic "let me focus" gesture.
	// Colors stay glued to their series either way (identity, not rank).
	const [hidden, setHidden] = useState<Set<string>>(new Set());
	const reduceMotion = useReducedMotion();
	const colors = useChartColors();
	const toggleSeries = (key: string) =>
		setHidden((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else if (next.size < 2) next.add(key); // never hide the last series
			return next;
		});
	const { data, isPending } = useQuery({
		queryKey: trendKeys.enrolments(days),
		queryFn: () => getEnrolmentTrend(days),
	});

	const series = [
		{
			key: "courses" as const,
			name: t("charts.series_courses", { defaultValue: "Courses" }),
			color: colors.categorical[0],
		},
		{
			key: "paths" as const,
			name: t("charts.series_paths", { defaultValue: "Paths" }),
			color: colors.categorical[1],
		},
		{
			key: "cohorts" as const,
			name: t("charts.series_cohorts", { defaultValue: "Cohorts" }),
			color: colors.categorical[2],
		},
	];

	const dateLabel = useMemo(
		() => (iso: string) =>
			new Date(`${iso}T00:00:00Z`).toLocaleDateString(i18n.language, {
				day: "numeric",
				month: "short",
				timeZone: "UTC",
			}),
		[i18n.language],
	);

	return (
		<ChartCard
			title={t("charts.enrolments_title", { defaultValue: "Enrolments" })}
			subtitle={t("charts.enrolments_subtitle", {
				defaultValue: "New enrolments into your content per day (UTC).",
			})}
			filters={
				<RangePicker
					value={days}
					onChange={setDays}
					label={t("charts.range", { defaultValue: "Date range" })}
					options={[
						{ value: 30, label: t("charts.days_30", { defaultValue: "30d" }) },
						{ value: 90, label: t("charts.days_90", { defaultValue: "90d" }) },
						{ value: 365, label: t("charts.days_365", { defaultValue: "1y" }) },
					]}
				/>
			}
			table={
				data
					? {
							headers: [
								t("charts.col_date", { defaultValue: "Date" }),
								...series.map((s) => s.name),
							],
							rows: data.map((p) => [
								dateLabel(p.date),
								p.courses,
								p.paths,
								p.cohorts,
							]),
						}
					: undefined
			}
		>
			{isPending || !data ? (
				<Skeleton className="h-64 w-full rounded-card" />
			) : (
				<div className="h-64 w-full" aria-hidden>
					<ResponsiveContainer width="100%" height="100%">
						<LineChart
							data={data}
							margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
						>
							<CartesianGrid
								stroke={colors.grid}
								strokeDasharray="0"
								vertical={false}
							/>
							<XAxis
								dataKey="date"
								tickFormatter={dateLabel}
								tick={{ fill: colors.axis, fontSize: 11 }}
								tickLine={false}
								axisLine={{ stroke: colors.grid }}
								minTickGap={32}
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
								labelFormatter={(v) => dateLabel(String(v))}
								cursor={{ stroke: colors.axis, strokeDasharray: "3 3" }}
							/>
							<Legend
								iconType="circle"
								iconSize={8}
								wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
								onClick={(entry) => {
									const key = series.find((x) => x.name === entry.value)?.key;
									if (key) toggleSeries(key);
								}}
								formatter={(value) => {
									const key = series.find((x) => x.name === value)?.key;
									const off = key ? hidden.has(key) : false;
									return (
										<span style={{ opacity: off ? 0.4 : 1 }}>{value}</span>
									);
								}}
							/>
							{series.map((s) => (
								<Line
									key={s.key}
									type="monotone"
									dataKey={s.key}
									name={s.name}
									stroke={s.color}
									strokeWidth={2}
									dot={false}
									hide={hidden.has(s.key)}
									activeDot={{ r: 4, strokeWidth: 2 }}
									isAnimationActive={!reduceMotion}
									animationDuration={600}
								/>
							))}
						</LineChart>
					</ResponsiveContainer>
				</div>
			)}
		</ChartCard>
	);
}

export default EnrolmentTrendChart;
