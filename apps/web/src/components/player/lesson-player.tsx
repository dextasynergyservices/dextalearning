import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getMediaToken } from "@/lib/content-api";
import { AudioPlayer } from "./audio-player";
import { PdfViewer } from "./pdf-viewer";
import { TranscriptPanel } from "./transcript-panel";
import { VideoPlayer } from "./video-player";

/**
 * Resolves a lesson's protected media bundle and renders the matching player
 * (video/audio/pdf/text) plus the transcript panel. The single place the
 * learner side touches media delivery.
 */
export function LessonPlayer({
	lessonId,
	title,
}: {
	lessonId: string;
	title?: string;
}) {
	const { data, isPending, isError } = useQuery({
		queryKey: ["media-token", lessonId],
		queryFn: () => getMediaToken(lessonId),
		staleTime: 90 * 60 * 1000, // presigned URLs live 2h; refetch well before
	});

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
				/>
			) : null}

			{data.type === "audio" && data.audioUrl ? (
				<AudioPlayer
					src={data.audioUrl}
					captionUrls={data.captionUrls ?? {}}
					title={title}
				/>
			) : null}

			{data.type === "pdf" && data.pages ? (
				<PdfViewer pages={data.pages} title={title} />
			) : null}

			{data.type === "text" && data.contentText ? (
				<article
					className="prose prose-slate max-w-none rounded-card border border-slate-200 bg-white p-6 shadow-card"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: instructor rich-text authored via Tiptap, sanitized on render.
					dangerouslySetInnerHTML={{ __html: data.contentText }}
				/>
			) : null}

			{data.transcriptText ? (
				<TranscriptPanel text={data.transcriptText} />
			) : null}
		</div>
	);
}
