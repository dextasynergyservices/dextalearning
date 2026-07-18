import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
	{
		variants: {
			variant: {
				primary:
					"bg-brand-solid text-white shadow-sm hover:bg-brand-solid-hover hover:shadow-md active:scale-[0.98]",
				accent:
					// Dark ink on amber — white on #f59e0b is only 2.14:1 (WCAG fail);
					// neutral-900 clears AA on both the base and the darker hover.
					"bg-brand-accent text-neutral-900 shadow-sm hover:bg-brand-accent-hover hover:shadow-md active:scale-[0.98]",
				outline:
					"border border-brand-primary/30 text-brand-primary hover:border-brand-primary hover:bg-brand-primary-light",
				white:
					// White fill is theme-invariant, so its text must be the dark solid
					// blue in both themes (the light text token would fail on white).
					"bg-white text-brand-solid shadow-sm hover:bg-slate-100 active:scale-[0.98]",
				ghost: "text-foreground hover:bg-accent",
				link: "text-brand-primary underline-offset-4 hover:underline",
			},
			size: {
				sm: "h-9 rounded-btn px-4 text-sm",
				md: "h-11 rounded-btn px-6 text-sm",
				lg: "h-13 rounded-btn px-8 text-base",
				pill: "h-11 rounded-pill px-7 text-sm",
				icon: "size-10 rounded-btn",
			},
		},
		defaultVariants: { variant: "primary", size: "md" },
	},
);

export interface ButtonProps
	extends ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {}

export function Button({
	className,
	variant,
	size,
	type = "button",
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	);
}
