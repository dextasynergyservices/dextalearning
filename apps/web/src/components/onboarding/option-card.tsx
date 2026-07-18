import { Check } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

interface OptionCardProps {
	label: string;
	description?: string;
	selected: boolean;
	onClick: () => void;
	icon?: ComponentType<{ className?: string }>;
	/** `radio` shows a circle; `checkbox` (multi-select) shows a rounded box. */
	control?: "radio" | "checkbox";
}

/** A selectable onboarding option — icon + label, with a check affordance. */
export function OptionCard({
	label,
	description,
	selected,
	onClick,
	icon: Icon,
	control = "radio",
}: OptionCardProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={selected}
			className={cn(
				"flex w-full items-center gap-3 rounded-card border px-4 py-3.5 text-left transition-all active:scale-[0.99]",
				selected
					? "border-brand-primary bg-brand-primary-light"
					: "border-border hover:border-brand-primary/40 hover:bg-accent",
			)}
		>
			{Icon ? (
				<span
					className={cn(
						"flex size-10 shrink-0 items-center justify-center rounded-btn transition-colors",
						selected
							? "bg-brand-solid text-white"
							: "bg-muted text-muted-foreground",
					)}
				>
					<Icon className="size-5" />
				</span>
			) : null}
			<span className="min-w-0 flex-1">
				<span
					className={cn(
						"block font-medium",
						selected ? "text-brand-primary" : "text-foreground",
					)}
				>
					{label}
				</span>
				{description ? (
					<span className="mt-0.5 block text-muted-foreground text-sm">
						{description}
					</span>
				) : null}
			</span>
			<span
				className={cn(
					"flex size-5 shrink-0 items-center justify-center border transition-colors",
					control === "checkbox" ? "rounded-md" : "rounded-full",
					selected
						? "border-brand-primary bg-brand-solid text-white"
						: "border-border",
				)}
			>
				{selected ? <Check className="size-3.5" /> : null}
			</span>
		</button>
	);
}
