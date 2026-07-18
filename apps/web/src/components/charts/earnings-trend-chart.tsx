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
import { getEarningsTrend, trendKeys } from "@/lib/analytics-trends-api";
import { formatMoney } from "@/lib/earnings-api";
import { ChartCard, RangePicker } from "./chart-card";
import { useChartColors } from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

/**
 * Monthly earnings, stacked by HOW the money was earned (§8.5.1): the
 * guaranteed cut booked at payment, and forfeited Earn-Back booked at
 * resolution. Stacked bars because the reader's question is "how much, and of
 * what kind" per month; the 2px card-colored stroke is the mark-spec surface
 * gap between stacked segments. At-stake escrow is deliberately absent — this
 * chart must reconcile with the Earn-Back ledger, and at-stake is not money.
 */
export function EarningsTrendChart() {
	const { t, i18n } = useTranslation("authoring");
	const [months, setMonths] = useState(12);
	const colors = useChartColors();
	const reduceMotion = useReducedMotion();
	const { data, isPending } = useQuery({
		queryKey: trendKeys.earnings(months),
		queryFn: () => getEarningsTrend(months),
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

	const guaranteedName = t("charts.series_guaranteed", {
		defaultValue: "Guaranteed revenue",
	});
	const escrowName = t("charts.series_escrow", {
		defaultValue: "Forfeited Earn-Back",
	});

	return (
		<ChartCard
			title={t("charts.earnings_title", { defaultValue: "Earnings over time" })}
			subtitle={t("charts.earnings_subtitle", {
				defaultValue:
					"Booked when the money became yours: guaranteed cut at payment, forfeited Earn-Back at resolution (UTC months).",
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
								guaranteedName,
								escrowName,
							],
							rows: data.map((p) => [
								monthLabel(p.month),
								money(p.guaranteed),
								money(p.fromEscrow),
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
							{/* Stack order = booking order: guaranteed lands first. The
							    card-colored stroke is the 2px gap between segments. */}
							<Bar
								dataKey="guaranteed"
								name={guaranteedName}
								stackId="earned"
								fill={colors.categorical[0]}
								stroke="var(--card)"
								strokeWidth={2}
								isAnimationActive={!reduceMotion}
								animationDuration={600}
							/>
							<Bar
								dataKey="fromEscrow"
								name={escrowName}
								stackId="earned"
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

export default EarningsTrendChart;
