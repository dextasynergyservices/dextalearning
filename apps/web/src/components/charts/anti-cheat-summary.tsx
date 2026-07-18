import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, VideoOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { getAntiCheatSummary, trendKeys } from "@/lib/analytics-trends-api";
import { cn } from "@/lib/utils";
import { ChartCard, RangePicker } from "./chart-card";
import { useChartColors } from "./chart-theme";

/**
 * Anti-cheat health (§15, admin-only). Plain HTML on purpose — category bars
 * with direct labels beat a charting library here. One number gets special
 * treatment: `unmonitored` attempts score a clean 100 and are invisible to
 * every integrity filter (§4.6.2.1), so this card is the one place an admin
 * sees them without going looking.
 */
export function AntiCheatSummaryCard() {
	const { t } = useTranslation("authoring");
	const [days, setDays] = useState(30);
	const colors = useChartColors();
	const { data, isPending } = useQuery({
		queryKey: trendKeys.antiCheat(days),
		queryFn: () => getAntiCheatSummary(days),
	});

	const eventName = (type: string) =>
		t(`charts.event_${type}`, {
			// Fallback keeps unknown/new event types legible, never blank.
			defaultValue: type.replaceAll("_", " "),
		});

	const maxEvent = data?.eventCounts[0]?.count ?? 0;

	const stats = data
		? [
				{
					key: "attempts",
					label: t("charts.ac_attempts", { defaultValue: "Attempts" }),
					value: data.attempts,
					alert: false,
				},
				{
					key: "flagged",
					label: t("charts.ac_flagged", { defaultValue: "Flagged" }),
					value: data.flagged,
					alert: data.flagged > 0,
				},
				{
					key: "unmonitored",
					label: t("charts.ac_unmonitored", { defaultValue: "Unmonitored" }),
					value: data.unmonitored,
					alert: data.unmonitored > 0,
				},
				{
					key: "escalated",
					label: t("charts.ac_escalated", { defaultValue: "Escalated" }),
					value: data.escalated,
					alert: data.escalated > 0,
				},
				{
					key: "invalidated",
					label: t("charts.ac_invalidated", { defaultValue: "Invalidated" }),
					value: data.invalidated,
					alert: false,
				},
			]
		: [];

	return (
		<ChartCard
			title={t("charts.ac_title", { defaultValue: "Assessment integrity" })}
			subtitle={t("charts.ac_subtitle", {
				defaultValue: "Submitted attempts and what anti-cheat saw.",
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
								t("charts.col_event", { defaultValue: "Event" }),
								t("charts.col_count", { defaultValue: "Count" }),
							],
							rows: data.eventCounts.map((e) => [
								eventName(e.eventType),
								e.count,
							]),
						}
					: undefined
			}
		>
			{isPending || !data ? (
				<Skeleton className="h-56 w-full rounded-card" />
			) : (
				<div className="space-y-5">
					<dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-5">
						{stats.map((s) => (
							<div key={s.key} className="bg-card px-3 py-2.5">
								<dt className="text-muted-foreground text-xs">{s.label}</dt>
								<dd
									className={cn(
										"mt-0.5 flex items-center gap-1.5 font-stats font-bold text-base tabular-nums",
										// Status color + icon together — never color alone.
										s.alert
											? "text-amber-600 dark:text-amber-400"
											: "text-foreground",
									)}
								>
									{s.value}
									{s.alert && s.key === "unmonitored" ? (
										<VideoOff aria-hidden className="size-3.5" />
									) : s.alert ? (
										<ShieldAlert aria-hidden className="size-3.5" />
									) : null}
								</dd>
							</div>
						))}
					</dl>

					{data.eventCounts.length === 0 ? (
						<p className="py-4 text-center text-muted-foreground text-sm">
							{t("charts.ac_clean", {
								defaultValue:
									"No anti-cheat events in this window. Quiet is good.",
							})}
						</p>
					) : (
						<ol className="space-y-2.5">
							{data.eventCounts.map((e) => (
								<li key={e.eventType}>
									<div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
										<span className="font-medium text-foreground capitalize">
											{eventName(e.eventType)}
										</span>
										<span className="font-semibold text-foreground text-xs tabular-nums">
											{e.count}
										</span>
									</div>
									<div className="h-2.5 overflow-hidden rounded-[4px] bg-muted">
										<div
											className="h-full rounded-[4px]"
											style={{
												width: `${maxEvent > 0 ? Math.max(2, (e.count / maxEvent) * 100) : 0}%`,
												// One magnitude, one hue — event types are ranked
												// counts of the same thing, not five identities.
												backgroundColor: colors.sequential[2],
											}}
										/>
									</div>
								</li>
							))}
						</ol>
					)}
				</div>
			)}
		</ChartCard>
	);
}

export default AntiCheatSummaryCard;
