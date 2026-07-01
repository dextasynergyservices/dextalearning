import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
	/** Adds hover lift + tap feedback for clickable cards. */
	interactive?: boolean;
}

/**
 * Consistent surface primitive — unifies the card radius / border / shadow that
 * had been re-typed inline across pages. Pass `interactive` for clickable cards
 * to get the standard hover-lift + `active:scale` tap feedback (native feel).
 */
export function Card({ className, interactive, ...props }: CardProps) {
	return (
		<div
			className={cn(
				"rounded-card border border-border bg-card shadow-sm",
				interactive &&
					"transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]",
				className,
			)}
			{...props}
		/>
	);
}
