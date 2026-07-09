import type { ComponentType } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatTileData {
	key: string;
	icon: ComponentType<{ className?: string }>;
	value: string | number | null;
	label: string;
}

/** A single KPI tile — icon chip, big stat, label. `null` value → skeleton. */
export function StatTile({
	icon: Icon,
	value,
	label,
}: Omit<StatTileData, "key">) {
	return (
		<div className="rounded-card border border-border bg-card p-4 shadow-card">
			<span className="flex size-9 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
				<Icon className="size-4" />
			</span>
			{value === null ? (
				<Skeleton className="mt-4 h-7 w-16 rounded-btn" />
			) : (
				<p className="mt-3 font-stats font-bold text-2xl text-foreground tabular-nums">
					{value}
				</p>
			)}
			<p className="text-muted-foreground text-xs">{label}</p>
		</div>
	);
}

/** Responsive KPI grid. */
export function StatTileGrid({
	tiles,
	className,
}: {
	tiles: StatTileData[];
	className?: string;
}) {
	return (
		<div
			className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}
			data-testid="stat-tiles"
		>
			{tiles.map(({ key, ...tile }) => (
				<StatTile key={key} {...tile} />
			))}
		</div>
	);
}
