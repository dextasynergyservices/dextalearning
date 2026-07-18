import { useTranslation } from "react-i18next";
import { ChartCard } from "./chart-card";
import { useChartColors } from "./chart-theme";

export interface TopContentRow {
	id: string;
	title: string;
	enrollments: number;
}

/**
 * Which content carries the caller — ranked horizontal bars, top 5 + "Other".
 * One measure across ranked items = ONE hue (rank is the encoding; five
 * colors would claim five identities that don't exist). Plain HTML: direct
 * labels beat tooltips for a five-row ranking, and it costs no chart library.
 * Data comes from the overview the page already fetched — no second query.
 */
export function TopContentBars({ rows }: { rows: TopContentRow[] }) {
	const { t } = useTranslation("authoring");
	const colors = useChartColors();

	const sorted = [...rows].sort((a, b) => b.enrollments - a.enrollments);
	const top = sorted.slice(0, 5);
	const otherTotal = sorted.slice(5).reduce((s, r) => s + r.enrollments, 0);
	const bars = [
		...top.map((r) => ({ key: r.id, label: r.title, value: r.enrollments })),
		...(otherTotal > 0
			? [
					{
						key: "__other",
						label: t("charts.other", {
							defaultValue: "Other ({{count}})",
							count: sorted.length - 5,
						}),
						value: otherTotal,
					},
				]
			: []),
	];
	const max = bars[0]?.value ?? 0;

	return (
		<ChartCard
			title={t("charts.top_content_title", { defaultValue: "Top content" })}
			subtitle={t("charts.top_content_subtitle", {
				defaultValue: "Your most-enrolled content, all time.",
			})}
			table={
				bars.length
					? {
							headers: [
								t("charts.col_content", { defaultValue: "Content" }),
								t("charts.col_enrolments", { defaultValue: "Enrolments" }),
							],
							rows: bars.map((b) => [b.label, b.value]),
						}
					: undefined
			}
		>
			{bars.length === 0 || max === 0 ? (
				<p className="py-8 text-center text-muted-foreground text-sm">
					{t("charts.top_content_empty", {
						defaultValue: "Publish something and it will race to the top.",
					})}
				</p>
			) : (
				<ol className="space-y-3">
					{bars.map((bar) => (
						<li key={bar.key}>
							<div className="mb-1 flex min-w-0 items-baseline justify-between gap-2 text-sm">
								<span className="min-w-0 truncate font-medium text-foreground">
									{bar.label}
								</span>
								<span className="shrink-0 whitespace-nowrap font-semibold text-foreground text-xs tabular-nums">
									{bar.value}
								</span>
							</div>
							<div className="h-5 overflow-hidden rounded-[4px] bg-muted">
								<div
									className="h-full rounded-[4px] transition-[width] duration-300 motion-reduce:transition-none"
									style={{
										width: `${Math.max(2, (bar.value / max) * 100)}%`,
										backgroundColor:
											bar.key === "__other"
												? colors.sequential[0]
												: colors.sequential[2],
									}}
								/>
							</div>
						</li>
					))}
				</ol>
			)}
		</ChartCard>
	);
}
