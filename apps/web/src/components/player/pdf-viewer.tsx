import { FileText } from "lucide-react";
import { useCallback, useRef } from "react";

interface PdfViewerProps {
	/** Presigned WebP URL per rasterised page, in order. */
	pages: string[];
	title?: string;
	/**
	 * Read-progress (0–100) for auto-completion. The PDF scrolls inside its OWN
	 * container, so tracking lives here — not on a page-level sentinel, which
	 * fired the instant the (unloaded, near-zero-height) viewer mounted.
	 */
	onProgress?: (pct: number) => void;
}

/** Complete once the learner has scrolled through ≥ this fraction (§4.3). */
const READ_THRESHOLD = 0.8;

/**
 * PDF lesson viewer — renders server-rasterised page images. Learners
 * view the content as images with no native download/print, and right-click
 * save is the only path to the raw asset, which is never exposed.
 */
export function PdfViewer({ pages, title, onProgress }: PdfViewerProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const doneRef = useRef(false);
	const loadedRef = useRef(0);

	// Fire once the visible-through fraction crosses the threshold. Runs on
	// scroll AND on each image load (a document that fits entirely counts as
	// fully read only once its images have laid out real heights — never on the
	// pre-load mount, which is what made PDFs "complete" immediately).
	const evaluate = useCallback(() => {
		const el = scrollRef.current;
		if (!el || doneRef.current || !onProgress) return;
		const { scrollTop, clientHeight, scrollHeight } = el;
		const fitsEntirely = scrollHeight <= clientHeight + 1;
		const readFraction = fitsEntirely
			? loadedRef.current >= pages.length
				? 1
				: 0
			: (scrollTop + clientHeight) / scrollHeight;
		if (readFraction >= READ_THRESHOLD) {
			doneRef.current = true;
			onProgress(100);
		}
	}, [onProgress, pages.length]);

	return (
		<div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
			<div className="flex items-center gap-3 border-border border-b px-4 py-3">
				<FileText className="size-5 text-brand-primary" />
				<p className="font-display text-foreground text-sm">
					{title ?? "PDF document"}
				</p>
			</div>
			<div
				ref={scrollRef}
				onScroll={evaluate}
				data-testid="pdf-scroll"
				className="max-h-[75vh] space-y-3 overflow-y-auto bg-muted p-3"
			>
				{pages.length === 0 ? (
					<p className="py-10 text-center text-muted-foreground text-sm">
						This document is still being processed.
					</p>
				) : (
					pages.map((src, index) => (
						<img
							key={src}
							src={src}
							alt={`Page ${index + 1}`}
							loading="lazy"
							onLoad={() => {
								loadedRef.current += 1;
								evaluate();
							}}
							// Reserve height so unloaded pages don't collapse to ~0 and let
							// the reader reach "the bottom" without actually scrolling
							// through the document.
							// Content protection: block right-click save AND drag-to-save.
							draggable={false}
							className="mx-auto min-h-[60vh] w-full max-w-3xl select-none rounded-md bg-card shadow-sm"
							onContextMenu={(e) => e.preventDefault()}
						/>
					))
				)}
			</div>
		</div>
	);
}
