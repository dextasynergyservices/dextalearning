import { Table2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * The frame every chart lives in (§13.1, dataviz a11y pass): title + bucket
 * subtitle, an optional filter row, and a "view as table" toggle — the same
 * numbers as an accessible table, not a screen-reader dead end. The table is
 * the chart's data verbatim; if the two could disagree, the chart is wrong.
 */
export function ChartCard({
	title,
	subtitle,
	filters,
	table,
	children,
}: {
	title: string;
	subtitle?: string;
	/** One row of range/dimension controls, rendered above the plot. */
	filters?: ReactNode;
	/** Accessible twin of the plot: column headers + rows of the same data. */
	table?: { headers: string[]; rows: (string | number)[][] };
	children: ReactNode;
}) {
	const { t } = useTranslation("authoring");
	const [asTable, setAsTable] = useState(false);
	const regionId = useId();

	return (
		<section
			aria-labelledby={regionId}
			// min-w-0: a grid child defaults to min-width:auto, so without this the
			// card refuses to shrink below its content and text escapes the border.
			className="min-w-0 overflow-hidden rounded-card border border-border bg-card shadow-card"
		>
			<div className="flex flex-wrap items-start justify-between gap-3 border-border border-b px-5 py-4">
				<div className="min-w-0">
					<h3 id={regionId} className="font-display text-foreground text-lg">
						{title}
					</h3>
					{subtitle ? (
						<p className="mt-0.5 text-muted-foreground text-xs">{subtitle}</p>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					{filters}
					{table ? (
						<button
							type="button"
							aria-pressed={asTable}
							onClick={() => setAsTable((v) => !v)}
							title={t("charts.table_view", { defaultValue: "View as table" })}
							className={cn(
								"flex size-9 items-center justify-center rounded-btn border transition-colors",
								asTable
									? "border-brand-primary bg-brand-primary-light text-brand-primary"
									: "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
							)}
						>
							<Table2 className="size-4" />
							<span className="sr-only">
								{t("charts.table_view", { defaultValue: "View as table" })}
							</span>
						</button>
					) : null}
				</div>
			</div>

			{asTable && table ? (
				<div className="overflow-x-auto p-2">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-border border-b text-left text-muted-foreground text-xs">
								{table.headers.map((h) => (
									<th key={h} className="px-3 py-2 font-medium">
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{table.rows.map((row) => (
								<tr key={row.join("|")}>
									{row.map((cell, i) => (
										<td
											key={`${table.headers[i]}-${cell}`}
											className={cn(
												"px-3 py-2 text-foreground",
												i > 0 && "tabular-nums",
											)}
										>
											{cell}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="p-4 sm:p-5">{children}</div>
			)}
		</section>
	);
}

/** Segmented range picker for the filter row — one row, above the chart. */
export function RangePicker<T extends string | number>({
	value,
	options,
	onChange,
	label,
}: {
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
	label: string;
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: aria-pressed toggle buttons are a role="group" (WAI-ARIA), not a form <fieldset>
		<div
			role="group"
			aria-label={label}
			className="flex rounded-btn border border-border p-0.5"
		>
			{options.map((opt) => (
				<button
					key={String(opt.value)}
					type="button"
					aria-pressed={value === opt.value}
					onClick={() => onChange(opt.value)}
					className={cn(
						"h-8 rounded-[calc(var(--radius)-4px)] px-3 font-medium text-xs transition-colors",
						value === opt.value
							? "bg-brand-solid text-white"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}
