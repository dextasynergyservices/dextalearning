import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
	/** Lucide icon shown in the soft circular badge. */
	icon?: LucideIcon;
	title: string;
	description?: string;
	/** Optional CTA (e.g. a <Button> or <Link>), rendered below the text. */
	action?: ReactNode;
	className?: string;
	/** `card` (default) draws a dashed bordered panel; `bare` is text-only. */
	variant?: "card" | "bare";
}

/**
 * The single, consistent "nothing here yet" state used across the app — lists,
 * search, dashboards. Centered, friendly, and optionally actionable. Replaces
 * the ad-hoc inline "No items" strings that had drifted per page.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className,
	variant = "card",
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center px-6 py-12 text-center",
				variant === "card" &&
					"rounded-card border border-border border-dashed bg-muted/60",
				className,
			)}
		>
			{Icon ? (
				<div className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand-primary-light text-brand-primary">
					<Icon className="size-7" strokeWidth={1.75} />
				</div>
			) : null}
			<h3 className="font-display text-lg text-foreground">{title}</h3>
			{description ? (
				<p className="mt-1.5 max-w-sm text-balance text-muted-foreground text-sm">
					{description}
				</p>
			) : null}
			{action ? <div className="mt-6">{action}</div> : null}
		</div>
	);
}
