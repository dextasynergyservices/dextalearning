/**
 * Shared recharts tooltip, in design tokens (dataviz: text wears ink tokens,
 * never the series color — the colored dot carries identity).
 */
export function ChartTooltip({
	active,
	label,
	payload,
	format,
}: {
	active?: boolean;
	label?: string | number;
	payload?: { name?: string; value?: number | string; color?: string }[];
	format?: (value: number) => string;
}) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-card border border-border bg-card px-3 py-2 shadow-modal">
			<p className="mb-1 font-medium text-foreground text-xs">{label}</p>
			{payload.map((entry) => (
				<p
					key={entry.name}
					className="flex items-center gap-2 text-muted-foreground text-xs"
				>
					<span
						aria-hidden
						className="size-2 rounded-full"
						style={{ backgroundColor: entry.color }}
					/>
					<span className="flex-1">{entry.name}</span>
					<span className="font-semibold text-foreground tabular-nums">
						{format ? format(Number(entry.value)) : entry.value}
					</span>
				</p>
			))}
		</div>
	);
}
