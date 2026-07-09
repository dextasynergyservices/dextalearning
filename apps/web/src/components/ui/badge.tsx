import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-pill px-2.5 py-0.5 font-stats font-semibold text-xs uppercase tracking-wide",
	{
		variants: {
			tone: {
				open: "bg-success/10 text-success",
				soon: "bg-muted text-muted-foreground",
				free: "bg-brand-primary-light text-brand-primary",
				earnback: "bg-brand-accent-light text-amber-700 dark:text-amber-300",
				neutral: "bg-muted text-muted-foreground",
			},
		},
		defaultVariants: { tone: "neutral" },
	},
);

interface BadgeProps
	extends HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {}

/**
 * Pill badge primitive — the typed counterpart to the `.badge-*` utility classes
 * in index.css, so badges can be composed in TSX with a consistent API.
 */
export function Badge({ className, tone, ...props }: BadgeProps) {
	return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
