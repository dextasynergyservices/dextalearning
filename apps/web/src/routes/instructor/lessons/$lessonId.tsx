import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Check,
	CheckCircle2,
	CircleAlert,
	Clock3,
	FileText,
	Loader2,
	Music,
	RefreshCw,
	Trash2,
	Type,
	Video,
} from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/authoring/rich-text-editor";
import { StudioShell } from "@/components/authoring/studio-shell";
import { UploadField } from "@/components/authoring/upload-field";
import { AudioPlayer } from "@/components/player/audio-player";
import { PdfViewer } from "@/components/player/pdf-viewer";
import { VideoPlayer } from "@/components/player/video-player";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	getLessonForEdit,
	getMediaJobStatus,
	getMediaToken,
	removeCaption,
	removeMedia,
	updateLesson,
	updateTranscript,
	uploadAudio,
	uploadCaption,
	uploadPdf,
	uploadVideo,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/instructor/lessons/$lessonId")({
	component: InstructorLessonEditorRoute,
});

function InstructorLessonEditorRoute() {
	const { lessonId } = Route.useParams();
	return <LessonEditorPage lessonId={lessonId} area="instructor" />;
}

type MediaKind = "video" | "audio" | "pdf";
type EncodableMediaKind = "video" | "audio";
type MediaStatus = "empty" | "processing" | "ready";

const TYPES: {
	value: "video" | "audio" | "text" | "pdf";
	icon: ComponentType<{ className?: string }>;
}[] = [
	{ value: "video", icon: Video },
	{ value: "audio", icon: Music },
	{ value: "text", icon: Type },
	{ value: "pdf", icon: FileText },
];

const CAPTION_LANGS = ["en", "fr", "es", "pcm"] as const;

const UPLOADERS: Record<
	MediaKind,
	(lessonId: string, file: File, onP?: (p: number) => void) => Promise<unknown>
> = { video: uploadVideo, audio: uploadAudio, pdf: uploadPdf };

type EditableLesson = Awaited<ReturnType<typeof getLessonForEdit>>;

function getMediaStatus(
	kind: MediaKind,
	lesson: EditableLesson | undefined,
): MediaStatus {
	if (!lesson) return "empty";
	if (kind === "video") {
		if (lesson.videoKeysJson) return "ready";
		return lesson.videoDurationSec ? "processing" : "empty";
	}
	if (kind === "audio") {
		if (lesson.audioKey) return "ready";
		return lesson.audioDurationSec ? "processing" : "empty";
	}
	return lesson.pdfKey ? "ready" : "empty";
}

function isAnyMediaProcessing(lesson: EditableLesson | undefined) {
	return (
		getMediaStatus("video", lesson) === "processing" ||
		getMediaStatus("audio", lesson) === "processing"
	);
}

function estimateEncodingMinutes(kind: MediaKind, durationSec?: number | null) {
	if (!durationSec) return kind === "video" ? 3 : 1;
	const multiplier = kind === "video" ? 1.5 : 0.35;
	return Math.max(1, Math.ceil((durationSec / 60) * multiplier));
}

function formatDuration(seconds?: number | null) {
	if (!seconds) return "Under 15 min";
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return mins ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`;
}

/** Renders the actual player for already-uploaded media (preview). */
function MediaPreview({
	lessonId,
	kind,
}: {
	lessonId: string;
	kind: MediaKind;
}) {
	const { data } = useQuery({
		queryKey: ["media-token", lessonId],
		queryFn: () => getMediaToken(lessonId),
		staleTime: 60_000,
	});
	if (!data) return <Skeleton className="aspect-video w-full rounded-card" />;
	if (kind === "video" && data.qualities)
		return (
			<VideoPlayer
				qualities={data.qualities}
				defaultQuality={data.defaultQuality}
				captionUrls={data.captionUrls ?? {}}
			/>
		);
	if (kind === "audio" && data.audioUrl)
		return (
			<AudioPlayer src={data.audioUrl} captionUrls={data.captionUrls ?? {}} />
		);
	if (kind === "pdf" && data.pages) return <PdfViewer pages={data.pages} />;
	return (
		<p className="rounded-card border border-slate-200 bg-slate-50 p-4 text-slate-500 text-sm">
			Still processing…
		</p>
	);
}

function EncodingStatusCard({
	lessonId,
	kind,
	durationSec,
	onRefresh,
}: {
	lessonId: string;
	kind: EncodableMediaKind;
	durationSec?: number | null;
	onRefresh: () => void;
}) {
	const { t } = useTranslation("authoring");
	const [elapsed, setElapsed] = useState(0);
	const estimate = estimateEncodingMinutes(kind, durationSec);
	const { data: jobStatus } = useQuery({
		queryKey: ["media-job-status", lessonId, kind],
		queryFn: () => getMediaJobStatus(lessonId, kind),
		refetchInterval: (query) =>
			query.state.data?.state === "completed" ||
			query.state.data?.state === "failed"
				? false
				: 1_500,
	});

	useEffect(() => {
		setElapsed(0);
		const timer = window.setInterval(
			() => setElapsed((value) => value + 1),
			1000,
		);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		if (jobStatus?.state === "completed") onRefresh();
	}, [jobStatus?.state, onRefresh]);

	const elapsedLabel = formatDuration(elapsed);
	const durationLabel = formatDuration(durationSec);
	const progress = Math.max(0, Math.min(100, jobStatus?.progress ?? 0));
	const isFailed = jobStatus?.state === "failed";
	const stateLabel = jobStatus?.state
		? t(`lesson.job_state_${jobStatus.state}`, {
				defaultValue: jobStatus.state.replace(/_/g, " "),
			})
		: t("lesson.job_state_waiting", { defaultValue: "waiting" });

	return (
		<div
			className={cn(
				"overflow-hidden rounded-card border",
				isFailed
					? "border-error/30 bg-error/5"
					: "border-amber-200 bg-amber-50/70",
			)}
		>
			<div className="grid gap-4 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5">
				<span
					className={cn(
						"flex size-12 items-center justify-center rounded-full bg-white shadow-sm",
						isFailed ? "text-error" : "text-amber-600",
					)}
				>
					{isFailed ? (
						<CircleAlert className="size-6" />
					) : (
						<Loader2 className="size-6 animate-spin" />
					)}
				</span>
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<p className="font-semibold text-slate-900 text-sm">
							{t("lesson.encoding_title", {
								defaultValue:
									kind === "video" ? "Encoding video" : "Processing audio",
							})}
						</p>
						<span
							className={cn(
								"rounded-full bg-white px-2 py-0.5 font-stats text-[0.65rem] uppercase",
								isFailed ? "text-error" : "text-amber-700",
							)}
						>
							{stateLabel}
						</span>
					</div>
					<p className="mt-1 text-slate-600 text-sm">
						{isFailed
							? (jobStatus?.failedReason ??
								t("lesson.encoding_failed_body", {
									defaultValue:
										"Encoding failed. Replace the file and try again.",
								}))
							: kind === "video"
								? t("lesson.video_encoding_body", {
										defaultValue:
											"We are creating 1080p, 720p, 480p, 320p, 240p and 144p versions.",
									})
								: t("lesson.audio_encoding_body", {
										defaultValue:
											"We are normalizing loudness and preparing the protected audio file.",
									})}
					</p>
					<div className="mt-3 grid gap-2 text-slate-500 text-xs sm:grid-cols-3">
						<span className="inline-flex items-center gap-1.5">
							<CheckCircle2 className="size-3.5 text-success" />
							{t("lesson.upload_complete", { defaultValue: "Upload complete" })}
						</span>
						<span className="inline-flex items-center gap-1.5">
							<Clock3 className="size-3.5" />
							{t("lesson.encoding_elapsed", {
								defaultValue: "Elapsed {{time}}",
								time: elapsedLabel,
							})}
						</span>
						<span>
							{jobStatus?.jobId
								? t("lesson.encoding_progress", {
										defaultValue: "{{progress}}% complete",
										progress,
									})
								: t("lesson.encoding_estimate", {
										defaultValue: "Usually ~{{minutes}} min",
										minutes: estimate,
									})}
						</span>
					</div>
					<div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
						<div
							className={cn(
								"h-full rounded-full transition-all",
								isFailed ? "bg-error" : "bg-amber-500",
								progress === 0 && !isFailed && "animate-pulse",
							)}
							style={{ width: `${Math.max(progress, isFailed ? 100 : 8)}%` }}
						/>
					</div>
					<p className="mt-2 text-slate-400 text-xs">
						{t("lesson.source_duration", {
							defaultValue: "Source length: {{duration}}",
							duration: durationLabel,
						})}
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={onRefresh}
					className="w-full bg-white sm:w-auto"
				>
					<RefreshCw className="size-4" />
					{t("lesson.check_status", { defaultValue: "Check" })}
				</Button>
			</div>
		</div>
	);
}

/** Shows the preview + replace/remove when media exists, else the upload field. */
function MediaSlot({
	lessonId,
	kind,
	status,
	durationSec,
	label,
	hint,
	accept,
	onChanged,
}: {
	lessonId: string;
	kind: MediaKind;
	status: MediaStatus;
	durationSec?: number | null;
	label: string;
	hint: string;
	accept: string;
	onChanged: () => void;
}) {
	const { t } = useTranslation("authoring");
	const [replacing, setReplacing] = useState(false);

	const remove = useMutation({
		mutationFn: () => removeMedia(lessonId, kind),
		onSuccess: () => {
			setReplacing(false);
			onChanged();
		},
		onError: (e) => toast.error(e.message),
	});

	if (status === "processing" && kind !== "pdf" && !replacing) {
		return (
			<div className="space-y-3">
				<EncodingStatusCard
					key={`${kind}-${durationSec ?? "unknown"}`}
					lessonId={lessonId}
					kind={kind}
					durationSec={durationSec}
					onRefresh={onChanged}
				/>
				<Button variant="outline" size="sm" onClick={() => setReplacing(true)}>
					{t("lesson.replace", "Replace")}
				</Button>
			</div>
		);
	}

	if (status === "ready" && !replacing) {
		return (
			<div className="space-y-3">
				<MediaPreview lessonId={lessonId} kind={kind} />
				<div className="flex flex-col gap-2 sm:flex-row">
					<Button
						variant="outline"
						size="sm"
						onClick={() => setReplacing(true)}
					>
						{t("lesson.replace", "Replace")}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => remove.mutate()}
						disabled={remove.isPending}
						className="border-error/30 text-error hover:bg-error/5"
					>
						<Trash2 className="size-4" />
						{t("lesson.remove", "Remove")}
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<UploadField
				label={label}
				hint={hint}
				accept={accept}
				onUpload={async (file, onP) => {
					await UPLOADERS[kind](lessonId, file, onP);
					setReplacing(false);
					onChanged();
				}}
				status={
					status === "ready"
						? "ready"
						: status === "processing"
							? "processing"
							: null
				}
				successMessage={
					kind === "pdf"
						? t("lesson.ready")
						: t("lesson.upload_queued", {
								defaultValue: "Upload complete. Encoding has started.",
							})
				}
			/>
			{status !== "empty" ? (
				<button
					type="button"
					onClick={() => setReplacing(false)}
					className="text-slate-400 text-xs hover:text-slate-600"
				>
					{t("lesson.cancel", "Cancel")}
				</button>
			) : null}
		</div>
	);
}

export function LessonEditorPage({
	lessonId,
	area = "instructor",
}: {
	lessonId: string;
	area?: "instructor" | "admin";
}) {
	const { t } = useTranslation("authoring");
	const queryClient = useQueryClient();

	const {
		data: lesson,
		isPending,
		isError,
		error,
	} = useQuery({
		queryKey: ["lesson", lessonId],
		queryFn: () => getLessonForEdit(lessonId),
		refetchInterval: (query) =>
			isAnyMediaProcessing(query.state.data) ? 3_000 : false,
	});

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ["lesson", lessonId] });
		queryClient.invalidateQueries({ queryKey: ["media-token", lessonId] });
	};

	const [transcript, setTranscript] = useState("");
	const [richText, setRichText] = useState("");
	useEffect(() => {
		if (lesson) {
			setTranscript(lesson.transcriptText ?? "");
			setRichText(lesson.contentText ?? "");
		}
	}, [lesson]);

	const setType = useMutation({
		mutationFn: (contentType: string) =>
			updateLesson(lessonId, { contentType }),
		onSuccess: invalidate,
		onError: (e) => toast.error(e.message),
	});
	const saveTranscript = useMutation({
		mutationFn: () => updateTranscript(lessonId, transcript),
		onSuccess: () => {
			invalidate();
			toast.success(t("lesson.saved"));
		},
		onError: (e) => toast.error(e.message),
	});
	const saveText = useMutation({
		mutationFn: () => updateLesson(lessonId, { contentText: richText }),
		onSuccess: () => {
			invalidate();
			toast.success(t("lesson.saved"));
		},
		onError: (e) => toast.error(e.message),
	});

	const captionLangs = new Set(
		lesson?.captions?.map((c) => c.languageCode) ?? [],
	);
	const videoStatus = getMediaStatus("video", lesson);
	const audioStatus = getMediaStatus("audio", lesson);
	const pdfStatus = getMediaStatus("pdf", lesson);

	return (
		<StudioShell title={lesson?.title ?? t("lesson.title")} area={area}>
			{isPending ? (
				<Skeleton className="h-64 rounded-card" />
			) : isError || !lesson ? (
				<div className="rounded-card border border-error/30 bg-error/5 p-5 text-error">
					<p className="font-semibold">{t("lesson.load_failed")}</p>
					<p className="mt-1 text-sm">
						{error instanceof Error
							? error.message
							: t("lesson.load_failed_body")}
					</p>
				</div>
			) : (
				<div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
					{/* Left: content */}
					<div className="space-y-6">
						<div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
							<p className="mb-2 font-medium text-slate-700 text-sm">
								{t("lesson.type")}
							</p>
							<div className="grid grid-cols-4 gap-2">
								{TYPES.map(({ value, icon: Icon }) => (
									<button
										key={value}
										type="button"
										onClick={() => setType.mutate(value)}
										className={cn(
											"flex flex-col items-center gap-1.5 rounded-card border-2 py-3 transition-colors",
											lesson.contentType === value
												? "border-brand-primary bg-brand-primary-light text-brand-primary"
												: "border-slate-200 text-slate-500 hover:border-brand-primary/40",
										)}
									>
										<Icon className="size-5" />
										<span className="font-medium text-xs">
											{t(`lesson.type_${value}`)}
										</span>
									</button>
								))}
							</div>
						</div>

						{lesson.contentType === "video" ? (
							<div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
								<p className="mb-3 font-medium text-slate-700 text-sm">
									{t("lesson.upload_video")}
								</p>
								<MediaSlot
									lessonId={lessonId}
									kind="video"
									status={videoStatus}
									durationSec={lesson.videoDurationSec}
									label={t("lesson.upload_video")}
									hint={t("lesson.video_hint")}
									accept="video/*"
									onChanged={invalidate}
								/>
							</div>
						) : null}

						{lesson.contentType === "audio" ? (
							<div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
								<p className="mb-3 font-medium text-slate-700 text-sm">
									{t("lesson.upload_audio")}
								</p>
								<MediaSlot
									lessonId={lessonId}
									kind="audio"
									status={audioStatus}
									durationSec={lesson.audioDurationSec}
									label={t("lesson.upload_audio")}
									hint={t("lesson.audio_hint")}
									accept="audio/*"
									onChanged={invalidate}
								/>
							</div>
						) : null}

						{lesson.contentType === "pdf" ? (
							<div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
								<p className="mb-3 font-medium text-slate-700 text-sm">
									{t("lesson.upload_pdf")}
								</p>
								<MediaSlot
									lessonId={lessonId}
									kind="pdf"
									status={pdfStatus}
									label={t("lesson.upload_pdf")}
									hint={t("lesson.pdf_hint")}
									accept="application/pdf"
									onChanged={invalidate}
								/>
							</div>
						) : null}

						{lesson.contentType === "text" ? (
							<div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
								<p className="mb-3 font-medium text-slate-700 text-sm">
									{t("lesson.content_text")}
								</p>
								<RichTextEditor value={richText} onChange={setRichText} />
								<Button
									className="mt-3"
									size="sm"
									onClick={() => saveText.mutate()}
									disabled={saveText.isPending}
								>
									{saveText.isPending ? (
										<Loader2 className="size-4 animate-spin" />
									) : null}
									{t("lesson.save")}
								</Button>
							</div>
						) : null}
					</div>

					{/* Right: captions + transcript */}
					<div className="space-y-6">
						{lesson.contentType === "video" ||
						lesson.contentType === "audio" ? (
							<div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
								<p className="font-medium text-slate-700 text-sm">
									{t("lesson.captions")}
								</p>
								<p className="mt-0.5 text-slate-400 text-xs">
									{t("lesson.caption_hint")}
								</p>
								<div className="mt-3 space-y-2">
									{CAPTION_LANGS.map((lang) => (
										<CaptionRow
											key={lang}
											lessonId={lessonId}
											lang={lang}
											present={captionLangs.has(lang)}
											onChanged={invalidate}
										/>
									))}
								</div>
							</div>
						) : null}

						<div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
							<p className="font-medium text-slate-700 text-sm">
								{t("lesson.transcript")}
							</p>
							<p className="mt-0.5 text-slate-400 text-xs">
								{t("lesson.transcript_hint")}
							</p>
							<textarea
								value={transcript}
								onChange={(e) => setTranscript(e.target.value)}
								placeholder={t("lesson.transcript_placeholder")}
								rows={8}
								className="mt-3 w-full resize-y rounded-input border border-slate-200 p-3 text-slate-900 text-sm outline-none focus:border-brand-primary"
							/>
							<Button
								className="mt-3"
								size="sm"
								onClick={() => saveTranscript.mutate()}
								disabled={saveTranscript.isPending || !transcript.trim()}
							>
								{saveTranscript.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : null}
								{t("lesson.save_transcript")}
							</Button>
						</div>
					</div>
				</div>
			)}
		</StudioShell>
	);
}

function CaptionRow({
	lessonId,
	lang,
	present,
	onChanged,
}: {
	lessonId: string;
	lang: string;
	present: boolean;
	onChanged: () => void;
}) {
	const { t } = useTranslation("authoring");
	const upload = useMutation({
		mutationFn: (file: File) => uploadCaption(lessonId, lang, file),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});
	const remove = useMutation({
		mutationFn: () => removeCaption(lessonId, lang),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});

	return (
		<div className="flex items-center gap-3 rounded-btn border border-slate-200 px-3 py-2">
			<span className="w-10 font-stats font-semibold text-slate-600 text-xs uppercase">
				{lang}
			</span>
			{present ? (
				<>
					<span className="flex flex-1 items-center gap-1.5 text-success text-sm">
						<Check className="size-4" /> {t("lesson.caption_uploaded")}
					</span>
					<button
						type="button"
						onClick={() => remove.mutate()}
						className="text-slate-400 transition-colors hover:text-error"
						aria-label={t("lesson.caption_remove")}
					>
						<Trash2 className="size-4" />
					</button>
				</>
			) : (
				<label className="flex-1 cursor-pointer text-brand-primary text-sm hover:underline">
					<input
						type="file"
						accept=".vtt,.srt"
						className="sr-only"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) upload.mutate(file);
						}}
					/>
					{upload.isPending
						? t("lesson.caption_uploading")
						: t("lesson.caption_upload_file")}
				</label>
			)}
		</div>
	);
}
