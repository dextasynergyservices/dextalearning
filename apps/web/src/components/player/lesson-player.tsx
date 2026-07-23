import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
	getIntroMediaToken,
	getMediaToken,
	getPreviewMediaToken,
} from "@/lib/content-api";
import { AudioPlayer } from "./audio-player";
import { PdfViewer } from "./pdf-viewer";
import { TranscriptPanel } from "./transcript-panel";
import { VideoPlayer } from "./video-player";

// Monaco is ~2MB — code-split so it loads only when a `code` lesson opens.
const CodeLesson = lazy(() =>
	import("./code-lesson").then((m) => ({ default: m.CodeLesson })),
);

/**
 * Resolves a lesson's protected media bundle and renders the matching player
 * (video/audio/pdf/text) plus the transcript panel. The single place the
 * learner side touches media delivery.
 */
export function LessonPlayer({
	lessonId,
	title,
	onProgress,
	resumePct = 0,
	preview = false,
	intro = false,
	done = false,
}: {
	lessonId: string;
	title?: string;
	/** Watched/listened/read fraction (0–100); drives auto-completion. */
	onProgress?: (pct: number) => void;
	/** Resume position (0–100) for video/audio. */
	resumePct?: number;
	/** Use the public free-preview endpoint (no auth) instead of the protected one. */
	preview?: boolean;
	/** Use the public path/cohort intro endpoint (no auth). */
	intro?: boolean;
	/** Whether the lesson is already complete (code lessons show a done label). */
	done?: boolean;
}) {
	const { data, isPending, isError } = useQuery({
		queryKey: [
			"media-token",
			intro ? "intro" : preview ? "preview" : "full",
			lessonId,
		],
		queryFn: () =>
			intro
				? getIntroMediaToken(lessonId)
				: preview
					? getPreviewMediaToken(lessonId)
					: getMediaToken(lessonId),
		staleTime: 90 * 60 * 1000, // presigned URLs live 2h; refetch well before
	});

	// Current playback time (seconds) + a seek handle, shared with the transcript
	// panel so it can highlight the active cue and scrub on click.
	const [currentSec, setCurrentSec] = useState(0);
	const seekRef = useRef<((seconds: number) => void) | null>(null);

	// TEXT: renders full-height in page flow, so a page-level "scrolled to end"
	// sentinel is correct. PDF is different — it scrolls inside its OWN capped
	// container, so PdfViewer tracks its own read-progress (a page-level
	// sentinel fired the instant the not-yet-laid-out viewer mounted).
	const endRef = useRef<HTMLDivElement>(null);
	const isText = data?.type === "text";
	useEffect(() => {
		if (!onProgress || !isText) return;
		const el = endRef.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) onProgress(100);
			},
			{ threshold: 0.6 },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [isText, onProgress]);

	if (isPending) {
		return <Skeleton className="aspect-video w-full rounded-card" />;
	}

	if (isError || !data) {
		return (
			<div className="flex items-center gap-3 rounded-card border border-error/30 bg-error/5 p-5 text-error">
				<AlertCircle className="size-5" />
				<p className="text-sm">This lesson could not be loaded.</p>
			</div>
		);
	}

	return (
		<div className="space-y-5">
			{data.type === "video" && data.qualities ? (
				<VideoPlayer
					qualities={data.qualities}
					defaultQuality={data.defaultQuality}
					captionUrls={data.captionUrls ?? {}}
					onProgress={onProgress}
					resumePct={resumePct}
					onTime={setCurrentSec}
					seekRef={seekRef}
				/>
			) : null}

			{data.type === "audio" && data.audioUrl ? (
				<AudioPlayer
					src={data.audioUrl}
					captionUrls={data.captionUrls ?? {}}
					title={title}
					onProgress={onProgress}
					resumePct={resumePct}
					onTime={setCurrentSec}
					seekRef={seekRef}
				/>
			) : null}

			{data.type === "pdf" && data.pages ? (
				<PdfViewer pages={data.pages} title={title} onProgress={onProgress} />
			) : null}

			{data.type === "text" && data.contentText ? (
				<article
					// Text stays selectable so learners can highlight/study; a blocked
					// context menu is kept as a light deterrent. `dark:prose-invert`
					// keeps the rich text readable in dark mode.
					className="prose prose-slate max-w-none rounded-card border border-border bg-card p-6 shadow-card dark:prose-invert"
					onContextMenu={(event) => event.preventDefault()}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: instructor rich-text authored via Tiptap, sanitized on render.
					dangerouslySetInnerHTML={{ __html: data.contentText }}
				/>
			) : null}

			{data.type === "code" && data.code ? (
				<Suspense
					fallback={<Skeleton className="h-[420px] w-full rounded-card" />}
				>
					<CodeLesson code={data.code} done={done} onProgress={onProgress} />
				</Suspense>
			) : null}

			{/* Scroll-to-end sentinel for TEXT completion tracking (PDF tracks
			    its own scroll internally). */}
			{isText ? <div ref={endRef} aria-hidden className="h-px w-full" /> : null}

			{data.transcriptText ? (
				<TranscriptPanel
					text={data.transcriptText}
					cues={data.transcriptCues ?? undefined}
					currentSec={currentSec}
					onSeek={(seconds) => seekRef.current?.(seconds)}
				/>
			) : null}
		</div>
	);
}
