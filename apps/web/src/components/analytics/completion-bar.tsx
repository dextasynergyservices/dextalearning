import { cn } from "@/lib/utils";

/**
 * A percentage shown as number + a single-hue thin bar (dataviz: magnitude =
 * one hue; the value stays in text tokens, so the metric is never encoded by
 * colour alone). `tone="success"` when the value represents completion.
 */
export function CompletionBar({
	value,
	tone = "primary",
	className,
}: {
	value: number;
	tone?: "primary" | "success";
	className?: string;
}) {
	return (
		<div className={className}>
			<span className="font-stats font-semibold text-foreground text-sm">
				{value}%
			</span>
			<span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
				<span
					className={cn(
						"block h-full rounded-full",
						tone === "success" ? "bg-success" : "bg-brand-solid",
					)}
					style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
				/>
			</span>
		</div>
	);
}
