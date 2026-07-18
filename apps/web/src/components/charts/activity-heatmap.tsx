import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { getActivityHeatmap, trendKeys } from "@/lib/analytics-trends-api";
import { ChartCard, RangePicker } from "./chart-card";
import { useChartColors } from "./chart-theme";

/**
 * When learning happens: 7×24 grid of progress events (§15 names
 * `progress_events` as THE learning-analytics source — this is it, visualised).
 * Plain HTML grid: one magnitude → sequential single hue, intensity stepped
 * (never a smooth gradient — 4 steps read, 256 don't). Each cell carries its
 * numbers as text (title + aria-label), so nothing is color-alone.
 */
export function ActivityHeatmap() {
	const { t, i18n } = useTranslation("authoring");
	const [days, setDays] = useState(90);
	const colors = useChartColors();
	const { data, isPending } = useQuery({
		queryKey: trendKeys.heatmap(days),
		queryFn: () => getActivityHeatmap(days),
	});

	// Monday-first reading order; data uses 0=Sunday.
	const dowOrder = [1, 2, 3, 4, 5, 6, 0];
	const dayName = (dow: number) =>
		new Intl.DateTimeFormat(i18n.language, {
			weekday: "short",
			timeZone: "UTC",
		}).format(new Date(Date.UTC(2026, 5, 7 + dow))); // 2026-06-07 is a Sunday

	const grid = new Map<string, number>();
	let max = 0;
	for (const cell of data ?? []) {
		grid.set(`${cell.dow}:${cell.hour}`, cell.count);
		if (cell.count > max) max = cell.count;
	}

	/** 5 intensity steps of the sequential hue; 0 stays surface-muted. */
	const stepColor = (count: number): string | undefined => {
		if (count === 0 || max === 0) return undefined;
		const idx = Math.min(
			colors.sequential.length - 1,
			Math.floor((count / max) * colors.sequential.length),
		);
		return colors.sequential[idx];
	};

	const hours = Array.from({ length: 24 }, (_, h) => h);

	return (
		<ChartCard
			title={t("charts.heatmap_title", {
				defaultValue: "When learning happens",
			})}
			subtitle={t("charts.heatmap_subtitle", {
				defaultValue: "Learning activity by day and hour (UTC).",
			})}
			filters={
				<RangePicker
					value={days}
					onChange={setDays}
					label={t("charts.range", { defaultValue: "Date range" })}
					options={[
						{ value: 30, label: t("charts.days_30", { defaultValue: "30d" }) },
						{ value: 90, label: t("charts.days_90", { defaultValue: "90d" }) },
					]}
				/>
			}
			table={
				data
					? {
							headers: [
								t("charts.col_day", { defaultValue: "Day" }),
								t("charts.col_hour", { defaultValue: "Hour (UTC)" }),
								t("charts.col_events", { defaultValue: "Events" }),
							],
							rows: [...data]
								.sort((a, b) => b.count - a.count)
								.slice(0, 30)
								.map((c) => [dayName(c.dow), `${c.hour}:00`, c.count]),
						}
					: undefined
			}
		>
			{isPending ? (
				<Skeleton className="h-48 w-full rounded-card" />
			) : max === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					{t("charts.heatmap_empty", {
						defaultValue: "No learning activity in this window yet.",
					})}
				</p>
			) : (
				<div className="overflow-x-auto">
					<div className="min-w-[560px]">
						{dowOrder.map((dow) => (
							<div key={dow} className="mb-1 flex items-center gap-1">
								<span className="w-9 shrink-0 text-muted-foreground text-[10px]">
									{dayName(dow)}
								</span>
								{hours.map((hour) => {
									const count = grid.get(`${dow}:${hour}`) ?? 0;
									const label = t("charts.heatmap_cell", {
										defaultValue: "{{day}} {{hour}}:00 — {{count}} events",
										day: dayName(dow),
										hour,
										count,
									});
									return (
										<div
											key={hour}
											role="img"
											aria-label={label}
											title={label}
											className="h-4 flex-1 rounded-[3px] bg-muted transition-transform hover:scale-125 hover:ring-2 hover:ring-ring"
											style={{ backgroundColor: stepColor(count) }}
										/>
									);
								})}
							</div>
						))}
						<div className="mt-1 flex items-center gap-1 pl-9">
							{[0, 6, 12, 18, 23].map((h) => (
								<span
									key={h}
									className="text-[10px] text-muted-foreground"
									style={{ marginLeft: h === 0 ? 0 : `${(h / 24) * 82}%` }}
								>
									{h}:00
								</span>
							))}
						</div>
						<div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
							{t("charts.heatmap_less", { defaultValue: "Less" })}
							<span className="size-3 rounded-[3px] bg-muted" />
							{colors.sequential.map((c) => (
								<span
									key={c}
									className="size-3 rounded-[3px]"
									style={{ backgroundColor: c }}
								/>
							))}
							{t("charts.heatmap_more", { defaultValue: "More" })}
						</div>
					</div>
				</div>
			)}
		</ChartCard>
	);
}

export default ActivityHeatmap;
