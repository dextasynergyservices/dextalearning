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
import { AssessmentLauncher } from "@/components/authoring/assessment-launcher";
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
import { cuesToText, parseTimedTranscript } from "@/lib/transcript";
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
		<p className="rounded-card border border-border bg-muted p-4 text-muted-foreground text-sm">
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
						"flex size-12 items-center justify-center rounded-full bg-card shadow-sm",
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
						<p className="font-semibold text-foreground text-sm">
							{t("lesson.encoding_title", {
								defaultValue:
									kind === "video" ? "Encoding video" : "Processing audio",
							})}
						</p>
						<span
							className={cn(
								"rounded-full bg-card px-2 py-0.5 font-stats text-[0.65rem] uppercase",
								isFailed ? "text-error" : "text-amber-700",
							)}
						>
							{stateLabel}
						</span>
					</div>
					<p className="mt-1 text-muted-foreground text-sm">
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
					<div className="mt-3 grid gap-2 text-muted-foreground text-xs sm:grid-cols-3">
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
					<div className="mt-3 h-2 overflow-hidden rounded-full bg-card">
						<div
							className={cn(
								"h-full rounded-full transition-all",
								isFailed ? "bg-error" : "bg-amber-500",
								progress === 0 && !isFailed && "animate-pulse",
							)}
							style={{ width: `${Math.max(progress, isFailed ? 100 : 8)}%` }}
						/>
					</div>
					<p className="mt-2 text-muted-foreground text-xs">
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
					className="w-full bg-card sm:w-auto"
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
					className="text-muted-foreground text-xs hover:text-muted-foreground"
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
	// A path/cohort intro is a standalone lesson — hide quiz/preview controls.
	const isIntro = Boolean(lesson?.introForPathId || lesson?.introForCohortId);

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

	// Timed transcript (VTT/SRT → cues, parsed on the client; no AI). Enables the
	// in-player synced highlight. Captions are not touched.
	const [timedInput, setTimedInput] = useState("");
	const cueCount = Array.isArray(lesson?.transcriptCuesJson)
		? lesson.transcriptCuesJson.length
		: 0;
	const importTimed = useMutation({
		mutationFn: () => {
			const cues = parseTimedTranscript(timedInput);
			if (cues.length === 0) {
				throw new Error(
					t("lesson.timed_parse_error", {
						defaultValue:
							"No timed segments found. Paste a valid .vtt or .srt transcript.",
					}),
				);
			}
			return updateTranscript(lessonId, cuesToText(cues), cues);
		},
		onSuccess: () => {
			setTimedInput("");
			invalidate();
			toast.success(
				t("lesson.timed_saved", { defaultValue: "Synced transcript saved" }),
			);
		},
		onError: (e) => toast.error(e.message),
	});
	const removeTiming = useMutation({
		mutationFn: () =>
			updateTranscript(lessonId, lesson?.transcriptText ?? transcript),
		onSuccess: () => {
			invalidate();
			toast.success(
				t("lesson.timed_removed", { defaultValue: "Timing removed" }),
			);
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
						<div className="rounded-card border border-border bg-card p-5 shadow-card">
							<p className="mb-2 font-medium text-foreground text-sm">
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
												: "border-border text-muted-foreground hover:border-brand-primary/40",
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
							<div className="rounded-card border border-border bg-card p-5 shadow-card">
								<p className="mb-3 font-medium text-foreground text-sm">
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
							<div className="rounded-card border border-border bg-card p-5 shadow-card">
								<p className="mb-3 font-medium text-foreground text-sm">
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
							<div className="rounded-card border border-border bg-card p-5 shadow-card">
								<p className="mb-3 font-medium text-foreground text-sm">
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
							<div className="rounded-card border border-border bg-card p-5 shadow-card">
								<p className="mb-3 font-medium text-foreground text-sm">
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
							<div className="rounded-card border border-border bg-card p-5 shadow-card">
								<p className="font-medium text-foreground text-sm">
									{t("lesson.captions")}
								</p>
								<p className="mt-0.5 text-muted-foreground text-xs">
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

						<div className="rounded-card border border-border bg-card p-5 shadow-card">
							<p className="flex items-center gap-2 font-medium text-foreground text-sm">
								{t("lesson.transcript")}
								<span className="rounded-pill bg-brand-accent-light px-2 py-0.5 font-stats font-semibold text-[0.6rem] text-amber-700 uppercase">
									{t("lesson.required", {
										defaultValue: "Required to publish",
									})}
								</span>
							</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								{t("lesson.transcript_hint")}
							</p>
							{!transcript.trim() ? (
								<p className="mt-2 flex items-center gap-1.5 rounded-btn bg-brand-accent-light/50 px-3 py-2 text-amber-800 text-xs">
									<CircleAlert className="size-3.5 shrink-0" />
									{t("lesson.transcript_required_warn", {
										defaultValue:
											"Add a transcript — the course can't be published until every lesson has one (§4.2).",
									})}
								</p>
							) : null}
							<textarea
								value={transcript}
								onChange={(e) => setTranscript(e.target.value)}
								placeholder={t("lesson.transcript_placeholder")}
								rows={8}
								className="mt-3 w-full resize-y rounded-input border border-border p-3 text-foreground text-sm outline-none focus:border-brand-primary"
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

							{/* Timed transcript → in-player synced highlight (no AI). */}
							{lesson.contentType === "video" ||
							lesson.contentType === "audio" ? (
								<div className="mt-4 border-border border-t pt-4">
									<p className="flex items-center gap-2 font-medium text-foreground text-sm">
										{t("lesson.timed_transcript", {
											defaultValue: "Timed transcript",
										})}
										{cueCount > 0 ? (
											<span className="rounded-pill bg-success/10 px-2 py-0.5 font-stats font-semibold text-[0.6rem] text-success uppercase">
												{t("lesson.timed_active", {
													defaultValue: "{{count}} segments · synced",
													count: cueCount,
												})}
											</span>
										) : null}
									</p>
									<p className="mt-0.5 text-muted-foreground text-xs">
										{t("lesson.timed_hint", {
											defaultValue:
												"Paste or upload a .vtt / .srt file to highlight the transcript as the lesson plays. This doesn't change captions.",
										})}
									</p>

									{cueCount > 0 ? (
										<Button
											className="mt-3"
											size="sm"
											variant="outline"
											onClick={() => removeTiming.mutate()}
											disabled={removeTiming.isPending}
										>
											{removeTiming.isPending ? (
												<Loader2 className="size-4 animate-spin" />
											) : null}
											{t("lesson.timed_remove", {
												defaultValue: "Remove timing",
											})}
										</Button>
									) : (
										<>
											<textarea
												value={timedInput}
												onChange={(e) => setTimedInput(e.target.value)}
												placeholder={
													"WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nHello and welcome…"
												}
												rows={5}
												className="mt-3 w-full resize-y rounded-input border border-border p-3 font-mono text-foreground text-xs outline-none focus:border-brand-primary"
											/>
											<div className="mt-2 flex flex-wrap items-center gap-2">
												<label className="cursor-pointer text-brand-primary text-xs hover:underline">
													{t("lesson.timed_upload", {
														defaultValue: "Upload .vtt / .srt",
													})}
													<input
														type="file"
														accept=".vtt,.srt,text/vtt"
														className="hidden"
														onChange={async (e) => {
															const file = e.target.files?.[0];
															if (file) setTimedInput(await file.text());
															e.target.value = "";
														}}
													/>
												</label>
												<Button
													size="sm"
													onClick={() => importTimed.mutate()}
													disabled={importTimed.isPending || !timedInput.trim()}
												>
													{importTimed.isPending ? (
														<Loader2 className="size-4 animate-spin" />
													) : null}
													{t("lesson.timed_import", {
														defaultValue: "Import timing",
													})}
												</Button>
											</div>
										</>
									)}
								</div>
							) : null}
						</div>

						{/* Preview toggle + quizzes don't apply to a path/cohort intro. */}
						{!isIntro ? (
							<>
								<LessonPreviewToggle
									lessonId={lessonId}
									isPreview={!!lesson.isPreview}
									onChanged={invalidate}
								/>

								<LessonQuizPanel
									lessonId={lessonId}
									area={area}
									lesson={lesson}
									onChanged={invalidate}
								/>
							</>
						) : null}
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
		<div className="flex items-center gap-3 rounded-btn border border-border px-3 py-2">
			<span className="w-10 font-stats font-semibold text-muted-foreground text-xs uppercase">
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
						className="text-muted-foreground transition-colors hover:text-error"
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

/** Mark a lesson as a free public preview (§2.4). */
function LessonPreviewToggle({
	lessonId,
	isPreview,
	onChanged,
}: {
	lessonId: string;
	isPreview: boolean;
	onChanged: () => void;
}) {
	const { t } = useTranslation("authoring");
	const save = useMutation({
		mutationFn: (v: boolean) => updateLesson(lessonId, { isPreview: v }),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});
	return (
		<div className="rounded-card border border-border bg-card p-5 shadow-card">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<p className="font-medium text-foreground text-sm">
						{t("lesson.free_preview", { defaultValue: "Free preview" })}
					</p>
					<p className="text-muted-foreground text-xs">
						{t("lesson.free_preview_hint", {
							defaultValue:
								"Anyone can watch/read this lesson before enrolling.",
						})}
					</p>
				</div>
				<Switch
					checked={isPreview}
					label={t("lesson.free_preview", { defaultValue: "Free preview" })}
					onChange={(v) => save.mutate(v)}
				/>
			</div>
		</div>
	);
}

function Switch({
	checked,
	onChange,
	label,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
	label: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
				checked ? "bg-brand-primary" : "bg-muted",
			)}
		>
			<span
				className={cn(
					"inline-block size-5 transform rounded-full bg-card shadow transition-transform",
					checked ? "translate-x-5" : "translate-x-0.5",
				)}
			/>
		</button>
	);
}

/**
 * Per-lesson completion config (§4.3): minimum watch %, plus optional pre/post
 * lesson quizzes. The post-quiz, when enabled + populated, gates completion.
 * Question authoring reuses the AssessmentLauncher (lesson_pre/lesson_post).
 */
function LessonQuizPanel({
	lessonId,
	area,
	lesson,
	onChanged,
}: {
	lessonId: string;
	area: "instructor" | "admin";
	lesson: {
		contentType: string | null;
		minVideoWatchPct?: number | string | null;
		hasPreQuiz?: boolean;
		hasPostQuiz?: boolean;
		postQuizPassMark?: number | string | null;
	};
	onChanged: () => void;
}) {
	const { t } = useTranslation("authoring");
	const isMedia =
		lesson.contentType === "video" || lesson.contentType === "audio";
	const [watchPct, setWatchPct] = useState(
		Math.round(Number(lesson.minVideoWatchPct ?? 80)),
	);
	const [passMark, setPassMark] = useState(
		Math.round(Number(lesson.postQuizPassMark ?? 70)),
	);

	const save = useMutation({
		mutationFn: (body: Record<string, unknown>) => updateLesson(lessonId, body),
		onSuccess: onChanged,
		onError: (e) => toast.error(e.message),
	});
	const clamp = (n: number) =>
		Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

	return (
		<div className="rounded-card border border-border bg-card p-5 shadow-card">
			<p className="font-medium text-foreground text-sm">
				{t("lesson.quiz_title", { defaultValue: "Quizzes & completion" })}
			</p>
			<p className="mt-0.5 text-muted-foreground text-xs">
				{t("lesson.quiz_hint", {
					defaultValue: "Control how this lesson is marked complete (§4.3).",
				})}
			</p>

			{isMedia ? (
				<div className="mt-4 flex items-center justify-between gap-3">
					<label htmlFor="minwatch" className="text-foreground text-sm">
						{t("lesson.min_watch", {
							defaultValue: "Minimum watched to complete",
						})}
					</label>
					<div className="flex items-center gap-1">
						<input
							id="minwatch"
							type="number"
							min={0}
							max={100}
							value={watchPct}
							onChange={(e) => setWatchPct(clamp(Number(e.target.value)))}
							onBlur={() => save.mutate({ minVideoWatchPct: watchPct })}
							className="w-16 rounded-input border border-border px-2 py-1.5 text-right text-sm outline-none focus:border-brand-primary"
						/>
						<span className="text-muted-foreground text-sm">%</span>
					</div>
				</div>
			) : null}

			<div className="mt-4 border-border border-t pt-4">
				<div className="flex items-center justify-between gap-3">
					<div className="min-w-0">
						<p className="font-medium text-foreground text-sm">
							{t("lesson.pre_quiz", { defaultValue: "Pre-lesson quiz" })}
						</p>
						<p className="text-muted-foreground text-xs">
							{t("lesson.pre_quiz_hint", {
								defaultValue: "Optional recall check before the lesson.",
							})}
						</p>
					</div>
					<Switch
						checked={!!lesson.hasPreQuiz}
						label={t("lesson.pre_quiz", { defaultValue: "Pre-lesson quiz" })}
						onChange={(v) => save.mutate({ hasPreQuiz: v })}
					/>
				</div>
				{lesson.hasPreQuiz ? (
					<div className="mt-3">
						<AssessmentLauncher
							scope="lesson_pre"
							parent={{ lessonId }}
							area={area}
						/>
					</div>
				) : null}
			</div>

			<div className="mt-4 border-border border-t pt-4">
				<div className="flex items-center justify-between gap-3">
					<div className="min-w-0">
						<p className="font-medium text-foreground text-sm">
							{t("lesson.post_quiz", { defaultValue: "Post-lesson quiz" })}
						</p>
						<p className="text-muted-foreground text-xs">
							{t("lesson.post_quiz_hint", {
								defaultValue: "Must be passed to complete the lesson.",
							})}
						</p>
					</div>
					<Switch
						checked={!!lesson.hasPostQuiz}
						label={t("lesson.post_quiz", { defaultValue: "Post-lesson quiz" })}
						onChange={(v) => save.mutate({ hasPostQuiz: v })}
					/>
				</div>
				{lesson.hasPostQuiz ? (
					<div className="mt-3 space-y-3">
						<div className="flex items-center justify-between gap-3">
							<label htmlFor="passmark" className="text-foreground text-sm">
								{t("lesson.pass_mark", { defaultValue: "Pass mark" })}
							</label>
							<div className="flex items-center gap-1">
								<input
									id="passmark"
									type="number"
									min={0}
									max={100}
									value={passMark}
									onChange={(e) => setPassMark(clamp(Number(e.target.value)))}
									onBlur={() => save.mutate({ postQuizPassMark: passMark })}
									className="w-16 rounded-input border border-border px-2 py-1.5 text-right text-sm outline-none focus:border-brand-primary"
								/>
								<span className="text-muted-foreground text-sm">%</span>
							</div>
						</div>
						<AssessmentLauncher
							scope="lesson_post"
							parent={{ lessonId }}
							area={area}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
