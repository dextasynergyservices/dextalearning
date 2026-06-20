import { ChevronDown, ScrollText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Collapsible transcript panel (WCAG 2.2 AA — every lesson has a transcript,
 * §4.2). Defaults open on desktop; collapsible to save room on mobile.
 */
export function TranscriptPanel({ text }: { text: string }) {
	const { t } = useTranslation("academy");
	const [open, setOpen] = useState(true);

	return (
		<section className="rounded-card border border-slate-200 bg-white shadow-card">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				className="flex w-full items-center gap-3 px-5 py-4 text-left"
			>
				<ScrollText className="size-5 text-brand-primary" />
				<span className="flex-1 font-display text-slate-900">
					{t("lesson.transcript", "Transcript")}
				</span>
				<ChevronDown
					className={cn(
						"size-5 text-slate-400 transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
			{open ? (
				<div className="max-h-[50vh] overflow-y-auto border-slate-100 border-t px-5 py-4">
					<p className="whitespace-pre-wrap text-slate-600 text-sm leading-relaxed">
						{text}
					</p>
				</div>
			) : null}
		</section>
	);
}
