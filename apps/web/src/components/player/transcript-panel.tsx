import { ChevronDown, ScrollText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReadingLanguageToggle } from "@/components/learn/reading-language-toggle";
import { useReadingTranslation } from "@/hooks/use-reading-translation";
import { activeCueIndex, type TranscriptCue } from "@/lib/transcript";
import { cn } from "@/lib/utils";

function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const m = Math.floor(s / 60);
	return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Collapsible transcript panel (WCAG 2.2 AA — every lesson has a transcript,
 * §4.2). When the lesson carries a **timed transcript** (`cues`), it becomes an
 * interactive transcript: the active segment highlights in sync with playback,
 * auto-scrolls, and clicking a line scrubs the player. Otherwise it falls back
 * to the flat text. Either way the displayed text can be read in any language
 * via the existing read-only translation layer (timestamps are untouched).
 */
export function TranscriptPanel({
	text,
	cues,
	currentSec = 0,
	onSeek,
}: {
	text: string;
	cues?: TranscriptCue[];
	currentSec?: number;
	onSeek?: (seconds: number) => void;
}) {
	const { t } = useTranslation("academy");
	const [open, setOpen] = useState(true);
	const hasCues = Boolean(cues && cues.length > 0);

	const texts = useMemo(
		() => (hasCues ? (cues ?? []).map((c) => c.text) : [text]),
		[hasCues, cues, text],
	);
	const { lang, setLang, tr, loading } = useReadingTranslation(texts);

	const active = hasCues ? activeCueIndex(cues ?? [], currentSec) : -1;
	const scrollRef = useRef<HTMLDivElement>(null);
	const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);

	// Keep the active line centred within the panel (not the page) as it changes.
	useEffect(() => {
		if (!open || active < 0) return;
		const el = lineRefs.current[active];
		const container = scrollRef.current;
		if (!el || !container) return;
		container.scrollTo({
			top: el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2,
			behavior: "smooth",
		});
	}, [active, open]);

	return (
		<section className="rounded-card border border-border bg-card shadow-card">
			<div className="flex items-center gap-3 px-5 py-4">
				<button
					type="button"
					onClick={() => setOpen((value) => !value)}
					aria-expanded={open}
					className="flex flex-1 items-center gap-3 text-left"
				>
					<ScrollText className="size-5 text-brand-primary" />
					<span className="flex-1 font-display text-foreground">
						{t("lesson.transcript", "Transcript")}
						{hasCues ? (
							<span className="ml-2 rounded-pill bg-brand-primary/10 px-2 py-0.5 font-stats font-semibold text-[0.6rem] text-brand-primary uppercase">
								{t("lesson.transcript_synced", { defaultValue: "Synced" })}
							</span>
						) : null}
					</span>
					<ChevronDown
						className={cn(
							"size-5 text-muted-foreground transition-transform",
							open && "rotate-180",
						)}
					/>
				</button>
				{open ? (
					<ReadingLanguageToggle
						lang={lang}
						setLang={setLang}
						loading={loading}
					/>
				) : null}
			</div>

			{open ? (
				<div
					ref={scrollRef}
					className="max-h-[50vh] overflow-y-auto border-border border-t px-5 py-4"
				>
					{hasCues ? (
						<ol className="space-y-1">
							{(cues ?? []).map((cue, i) => (
								<li key={`${cue.start}-${cue.end}-${cue.text.slice(0, 12)}`}>
									<button
										type="button"
										ref={(el) => {
											lineRefs.current[i] = el;
										}}
										onClick={() => onSeek?.(cue.start)}
										className={cn(
											"flex w-full items-start gap-3 rounded-btn px-2 py-1.5 text-left text-sm leading-relaxed transition-colors",
											i === active
												? "bg-brand-primary/10 font-medium text-foreground"
												: "text-muted-foreground hover:bg-accent",
										)}
									>
										<span className="mt-0.5 shrink-0 font-stats text-[0.7rem] text-muted-foreground tabular-nums">
											{clock(cue.start)}
										</span>
										<span>{tr(cue.text)}</span>
									</button>
								</li>
							))}
						</ol>
					) : (
						<p className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
							{tr(text)}
						</p>
					)}
				</div>
			) : null}
		</section>
	);
}
