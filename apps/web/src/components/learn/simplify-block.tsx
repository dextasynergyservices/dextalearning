import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	AlertCircle,
	ChevronDown,
	Loader2,
	TriangleAlert,
	WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/lib/api";
import { simplifyLesson } from "@/lib/simplifier-api";
import { cn } from "@/lib/utils";

/**
 * Content Simplifier (§4.10 — "Simplify this"). An additive, on-demand card:
 * one tap fetches a plain-language rewrite of the lesson's text (the server
 * picks reading content or transcript) and shows it beneath, toggleable — the
 * original is never replaced. Native-feeling inline on mobile and desktop.
 */
export function SimplifyBlock({ lessonId }: { lessonId: string }) {
	const { t } = useTranslation("ai");
	const reduceMotion = useReducedMotion();
	const [open, setOpen] = useState(false);
	const [simplified, setSimplified] = useState<string | null>(null);

	const run = useMutation({
		mutationFn: () => simplifyLesson(lessonId),
		onSuccess: (res) => {
			setSimplified(res.simplified);
			setOpen(true);
		},
	});

	const handleToggle = () => {
		if (simplified) {
			setOpen((o) => !o);
			return;
		}
		if (!run.isPending) run.mutate();
	};

	const errorMessage =
		run.error instanceof ApiError && run.error.code === "AI_DAILY_LIMIT"
			? t("simplify.limit", {
					defaultValue: "You've reached today's AI limit. Try again tomorrow.",
				})
			: run.error instanceof ApiError
				? run.error.message
				: t("simplify.error", { defaultValue: "Couldn't simplify this." });

	return (
		<section className="overflow-hidden rounded-card border border-brand-primary/20 bg-card shadow-card">
			<button
				type="button"
				onClick={handleToggle}
				aria-expanded={open}
				className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-brand-primary-light/40"
			>
				<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
					{run.isPending ? (
						<Loader2 className="size-5 animate-spin" />
					) : (
						<WandSparkles className="size-5" />
					)}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block font-display text-foreground text-sm">
						{run.isPending
							? t("simplify.loading", { defaultValue: "Simplifying…" })
							: t("simplify.action", { defaultValue: "Simplify this lesson" })}
					</span>
					<span className="block truncate text-muted-foreground text-xs">
						{t("simplify.subtitle", {
							defaultValue: "A plain-language version, same meaning",
						})}
					</span>
				</span>
				{simplified ? (
					<ChevronDown
						className={cn(
							"size-5 shrink-0 text-muted-foreground transition-transform",
							open && "rotate-180",
						)}
					/>
				) : null}
			</button>

			{run.isError && !simplified ? (
				<div className="flex items-center justify-between gap-3 border-border border-t px-4 py-3">
					<span className="flex items-center gap-2 text-destructive text-sm">
						<AlertCircle className="size-4 shrink-0" />
						{errorMessage}
					</span>
					<button
						type="button"
						onClick={() => run.mutate()}
						className="shrink-0 font-medium text-brand-primary text-sm hover:underline"
					>
						{t("simplify.retry", { defaultValue: "Try again" })}
					</button>
				</div>
			) : null}

			<AnimatePresence initial={false}>
				{open && simplified ? (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={
							reduceMotion
								? { duration: 0 }
								: { type: "spring", stiffness: 380, damping: 38 }
						}
						className="border-border border-t"
					>
						<p
							// Announce the plain-language rewrite when it appears.
							aria-live="polite"
							className="max-h-[26rem] overflow-y-auto whitespace-pre-wrap px-4 py-4 text-foreground text-sm leading-relaxed"
						>
							{simplified}
						</p>
						<p className="flex items-center gap-1.5 bg-muted/40 px-4 py-2 text-muted-foreground text-xs">
							<TriangleAlert className="size-3.5 shrink-0" />
							{t("simplify.disclaimer", {
								defaultValue: "AI can make mistakes — verify what matters.",
							})}
						</p>
					</motion.div>
				) : null}
			</AnimatePresence>
		</section>
	);
}
