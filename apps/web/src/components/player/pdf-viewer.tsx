import { FileText } from "lucide-react";

interface PdfViewerProps {
	/** Presigned WebP URL per rasterised page, in order. */
	pages: string[];
	title?: string;
}

/**
 * PDF lesson viewer — renders server-rasterised page images (§4.2). Learners
 * view the content as images with no native download/print, and right-click
 * save is the only path to the raw asset, which is never exposed.
 */
export function PdfViewer({ pages, title }: PdfViewerProps) {
	return (
		<div className="overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
			<div className="flex items-center gap-3 border-slate-100 border-b px-4 py-3">
				<FileText className="size-5 text-brand-primary" />
				<p className="font-display text-slate-900 text-sm">
					{title ?? "PDF document"}
				</p>
			</div>
			<div className="max-h-[75vh] space-y-3 overflow-y-auto bg-slate-100 p-3">
				{pages.length === 0 ? (
					<p className="py-10 text-center text-slate-400 text-sm">
						This document is still being processed.
					</p>
				) : (
					pages.map((src, index) => (
						<img
							key={src}
							src={src}
							alt={`Page ${index + 1}`}
							loading="lazy"
							className="mx-auto w-full max-w-3xl rounded-md bg-white shadow-sm"
							onContextMenu={(e) => e.preventDefault()}
						/>
					))
				)}
			</div>
		</div>
	);
}
