import { useReducedMotion } from "framer-motion";
import { useState } from "react";
import {
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Sector,
	Tooltip,
} from "recharts";
import type { PieSectorDataItem } from "recharts/types/polar/Pie";
import { cn } from "@/lib/utils";
import { useChartColors } from "./chart-theme";
import { ChartTooltip } from "./chart-tooltip";

export interface DonutSlice {
	key: string;
	label: string;
	value: number;
}

/**
 * Part-of-whole donut (dataviz: composition with FEW slices — callers pass
 * ≤5; a 6th belongs in "Other" upstream). The centre carries the headline
 * total, the side list is the legend AND the direct labels: colored mark +
 * label + value + share, text in ink tokens. Hovering a slice (or its legend
 * row) expands it slightly — identity is reinforced by interaction, never by
 * color alone.
 */
export function DonutChart({
	slices,
	total,
	totalLabel,
	format = (v) => String(v),
}: {
	slices: DonutSlice[];
	/** Centre headline; defaults to the sum of slices. */
	total?: string;
	totalLabel: string;
	format?: (value: number) => string;
}) {
	const colors = useChartColors();
	const reduceMotion = useReducedMotion();
	const [active, setActive] = useState<number | null>(null);
	const sum = slices.reduce((s, x) => s + x.value, 0);

	return (
		<div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:gap-5">
			<div className="relative h-40 w-40 shrink-0 xl:h-36 xl:w-36" aria-hidden>
				<ResponsiveContainer width="100%" height="100%">
					<PieChart>
						<Tooltip content={<ChartTooltip format={format} />} />
						<Pie
							data={slices as unknown as Record<string, unknown>[]}
							dataKey="value"
							nameKey="label"
							innerRadius="68%"
							outerRadius="92%"
							paddingAngle={2}
							strokeWidth={2}
							stroke="var(--card)"
							isAnimationActive={!reduceMotion}
							animationDuration={600}
							activeShape={(props: PieSectorDataItem) => (
								// Hover expansion: same slice, 6px further out.
								<Sector {...props} outerRadius={(props.outerRadius ?? 0) + 6} />
							)}
							onMouseEnter={(_, i) => setActive(i)}
							onMouseLeave={() => setActive(null)}
						>
							{slices.map((slice, i) => (
								<Cell
									key={slice.key}
									fill={colors.categorical[i % colors.categorical.length]}
								/>
							))}
						</Pie>
					</PieChart>
				</ResponsiveContainer>
				<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
					<span className="font-stats font-bold text-foreground text-xl tabular-nums">
						{total ?? format(sum)}
					</span>
					<span className="max-w-[7rem] text-center text-[11px] text-muted-foreground leading-tight">
						{totalLabel}
					</span>
				</div>
			</div>

			<ul className="w-full min-w-0 flex-1 space-y-1.5">
				{slices.map((slice, i) => {
					const pct = sum > 0 ? Math.round((slice.value / sum) * 100) : 0;
					return (
						<li key={slice.key}>
							<button
								type="button"
								onMouseEnter={() => setActive(i)}
								onMouseLeave={() => setActive(null)}
								onFocus={() => setActive(i)}
								onBlur={() => setActive(null)}
								className={cn(
									"flex w-full items-center gap-2.5 rounded-btn px-2 py-1.5 text-left text-sm transition-colors",
									active === i ? "bg-accent" : "hover:bg-accent/60",
								)}
							>
								<span
									aria-hidden
									className="size-2.5 shrink-0 rounded-full"
									style={{
										backgroundColor:
											colors.categorical[i % colors.categorical.length],
									}}
								/>
								<span className="min-w-0 flex-1 truncate text-foreground">
									{slice.label}
								</span>
								<span className="shrink-0 whitespace-nowrap font-semibold text-foreground tabular-nums">
									{format(slice.value)}
								</span>
								<span className="w-9 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
									{pct}%
								</span>
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
