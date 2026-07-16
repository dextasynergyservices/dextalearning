import { AlertTriangle, Loader2, X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	cancelLabel: string;
	isPending?: boolean;
	tone?: "danger" | "default";
	/** Optional body between the description and the buttons (e.g. a reason field). */
	children?: ReactNode;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel,
	cancelLabel,
	isPending = false,
	tone = "default",
	children,
	onConfirm,
	onOpenChange,
}: ConfirmDialogProps) {
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !isPending) onOpenChange(false);
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [isPending, onOpenChange, open]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-end justify-center px-3 py-4 sm:items-center"
			role="presentation"
		>
			<button
				type="button"
				aria-label={cancelLabel}
				disabled={isPending}
				onClick={() => onOpenChange(false)}
				className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm disabled:cursor-default"
			/>
			<section
				aria-describedby="confirm-dialog-description"
				aria-labelledby="confirm-dialog-title"
				aria-modal="true"
				className="relative w-full max-w-md rounded-card border border-border bg-popover p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:p-5"
				role="dialog"
			>
				<div className="flex items-start gap-3">
					<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
						<AlertTriangle className="size-5" />
					</span>
					<div className="min-w-0 flex-1">
						<h2
							id="confirm-dialog-title"
							className="font-display text-foreground text-lg"
						>
							{title}
						</h2>
						<p
							id="confirm-dialog-description"
							className="mt-1 text-muted-foreground text-sm"
						>
							{description}
						</p>
					</div>
					<button
						type="button"
						aria-label={cancelLabel}
						disabled={isPending}
						onClick={() => onOpenChange(false)}
						className="flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
					>
						<X className="size-4" />
					</button>
				</div>
				{children ? <div className="mt-4">{children}</div> : null}
				<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={isPending}
						className="w-full sm:w-auto"
					>
						{cancelLabel}
					</Button>
					<Button
						variant={tone === "danger" ? "primary" : "accent"}
						onClick={onConfirm}
						disabled={isPending}
						className={
							tone === "danger"
								? "w-full bg-error hover:bg-error/90 sm:w-auto"
								: "w-full sm:w-auto"
						}
					>
						{isPending ? <Loader2 className="size-4 animate-spin" /> : null}
						{confirmLabel}
					</Button>
				</div>
			</section>
		</div>
	);
}
