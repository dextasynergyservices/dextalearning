import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CatalogVisualTone = "primary" | "accent" | "dark";

const toneClasses: Record<CatalogVisualTone, string> = {
	primary: "border-brand-primary/15 bg-brand-primary-light text-brand-primary",
	accent: "border-brand-accent/25 bg-brand-accent-light text-brand-accent",
	dark: "border-hero-card bg-hero-bg text-white",
};

export function CatalogVisual({
	icon: Icon,
	label,
	meta,
	tone = "primary",
	children,
	className,
}: {
	icon: ComponentType<{ className?: string }>;
	label?: string;
	meta?: string;
	tone?: CatalogVisualTone;
	children?: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"relative flex aspect-video flex-col justify-between overflow-hidden border-b p-4",
				toneClasses[tone],
				className,
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<span
					className={cn(
						"flex size-12 items-center justify-center rounded-btn border bg-white/80 shadow-sm",
						tone === "dark" ? "border-white/10 bg-white/10" : "border-white",
					)}
				>
					<Icon className="size-6" />
				</span>
				{label ? (
					<span
						className={cn(
							"rounded-pill px-2.5 py-0.5 font-stats text-[0.65rem] uppercase",
							tone === "dark"
								? "bg-white/10 text-white"
								: "bg-white/80 text-slate-700",
						)}
					>
						{label}
					</span>
				) : null}
			</div>
			<div className="flex items-end justify-between gap-3">
				{meta ? (
					<p
						className={cn(
							"font-stats text-xs",
							tone === "dark" ? "text-slate-200" : "text-slate-600",
						)}
					>
						{meta}
					</p>
				) : (
					<span />
				)}
				{children}
			</div>
		</div>
	);
}
