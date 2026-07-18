import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlatformRevenueTrend, trendKeys } from "@/lib/analytics-trends-api";
import { formatMoney } from "@/lib/earnings-api";
import { ChartCard, RangePicker } from "./chart-card";
import { useChartColors } from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

/**
 * Platform revenue by month (§14.1.1 definitions, admin-only). Stacked by who
 * the money belongs to — instructors' cut + the platform's take = gross — so
 * the stack height IS gross and no separate line is needed (one axis, one
 * chart). Held/refunded Earn-Back never appears here: it is learners' money,
 * not revenue, and painting it would inflate every bar.
 */
export function PlatformRevenueChart() {
	const { t, i18n } = useTranslation("authoring");
	const [months, setMonths] = useState(12);
	const colors = useChartColors();
	const reduceMotion = useReducedMotion();
	const { data, isPending } = useQuery({
		queryKey: trendKeys.revenue(months),
		queryFn: () => getPlatformRevenueTrend(months),
	});

	const money = (n: number) => formatMoney(n, "NGN");
	const monthLabel = useMemo(
		() => (ym: string) =>
			new Date(`${ym}-01T00:00:00Z`).toLocaleDateString(i18n.language, {
				month: "short",
				year: "2-digit",
				timeZone: "UTC",
			}),
		[i18n.language],
	);

	const instructorsName = t("charts.series_instructors_cut", {
		defaultValue: "Instructors' earnings",
	});
	const platformName = t("charts.series_platform_take", {
		defaultValue: "Platform take",
	});

	return (
		<ChartCard
			title={t("charts.revenue_title", { defaultValue: "Platform revenue" })}
			subtitle={t("charts.revenue_subtitle", {
				defaultValue:
					"Settled orders by month paid (UTC). Stack height is gross; Earn-Back escrow is learners' money and is not shown.",
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
								instructorsName,
								platformName,
								t("charts.col_gross", { defaultValue: "Gross" }),
							],
							rows: data.map((p) => [
								monthLabel(p.month),
								money(p.instructorEarnings),
								money(p.platformTake),
								money(p.gross),
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
						<BarChart
							data={data}
							margin={{ top: 8, right: 12, bottom: 0, left: -4 }}
							barCategoryGap="28%"
						>
							<CartesianGrid stroke={colors.grid} vertical={false} />
							<XAxis
								dataKey="month"
								tickFormatter={monthLabel}
								tick={{ fill: colors.axis, fontSize: 11 }}
								tickLine={false}
								axisLine={{ stroke: colors.grid }}
								minTickGap={16}
							/>
							<YAxis
								tickFormatter={(v: number) =>
									v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
								}
								tick={{ fill: colors.axis, fontSize: 11 }}
								tickLine={false}
								axisLine={false}
								width={44}
							/>
							<Tooltip
								content={<ChartTooltip format={money} />}
								labelFormatter={(v) => monthLabel(String(v))}
								cursor={{ fill: colors.grid, fillOpacity: 0.35 }}
							/>
							<Legend
								iconType="circle"
								iconSize={8}
								wrapperStyle={{ fontSize: 12 }}
							/>
							{/* Instructors' share first: it's the larger slice (90/10), and
							    the stack reads bottom-up like the split itself. */}
							<Bar
								dataKey="instructorEarnings"
								name={instructorsName}
								stackId="gross"
								fill={colors.categorical[0]}
								stroke="var(--card)"
								strokeWidth={2}
								isAnimationActive={!reduceMotion}
								animationDuration={600}
							/>
							<Bar
								dataKey="platformTake"
								name={platformName}
								stackId="gross"
								fill={colors.categorical[1]}
								stroke="var(--card)"
								strokeWidth={2}
								radius={[4, 4, 0, 0]}
								isAnimationActive={!reduceMotion}
								animationDuration={600}
							/>
						</BarChart>
					</ResponsiveContainer>
				</div>
			)}
		</ChartCard>
	);
}

export default PlatformRevenueChart;
