import type { FaceLandmarksDetector } from "@tensorflow-models/face-landmarks-detection";
import { Loader2, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	type AntiCheatEventType,
	ingestAntiCheat,
	uploadProctoringSnapshot,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

// §4.6.2: analyse the camera at 30-second intervals (client-side only).
const INTERVAL_MS = 30_000;
/**
 * A single frame is not evidence. Blinks, head-turns, motion blur and a passing
 * shadow all read as "no face" for a moment — and at one sample every 30s, one
 * unlucky frame would flag the learner, upload a snapshot, dent their integrity
 * score, and leave the badge accusing them for the next half minute while their
 * face sat plainly in view. So a suspicious frame only opens an inquiry: re-look
 * a few times over ~2s and flag only if the face is *consistently* absent.
 */
const CONFIRM_SAMPLES = 4;
const CONFIRM_GAP_MS = 500;
/** While flagged, look again this often so the badge clears the moment they're back. */
const RECHECK_MS = 3_000;
/**
 * "Couldn't look" is not "looked and saw nothing". Right after the camera
 * starts, `video.readyState` is briefly < 2 and no frame exists to analyse — if
 * that costs us the full 30s cadence, the opening half-minute of the exam goes
 * unwatched while the badge says otherwise. Come straight back instead.
 */
const WARMUP_RETRY_MS = 1_000;
/**
 * The model is a large download. A cold cache, a slow network or a contended
 * machine can lose the first attempt to something entirely transient, so retry
 * before concluding that monitoring is impossible — every avoidable "monitoring
 * unavailable" is a real exam we failed to watch.
 */
const LOAD_ATTEMPTS = 3;
const LOAD_BACKOFF_MS = 2_000;

type Status = "loading" | "ok" | "missing" | "multiple" | "unavailable";

/** Downscale the current frame to a small JPEG thumbnail for proctoring review. */
async function captureThumbnail(video: HTMLVideoElement): Promise<Blob | null> {
	const width = 320;
	const ratio = video.videoWidth ? video.videoHeight / video.videoWidth : 0.75;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = Math.round(width * ratio) || 240;
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
	return new Promise((resolve) =>
		canvas.toBlob((b) => resolve(b), "image/jpeg", 0.6),
	);
}

/**
 * Camera monitoring (§4.6.2): runs TensorFlow.js face detection in the browser
 * every 30s, flags "no face" / "multiple faces", and uploads only a thumbnail of
 * flagged frames (never a continuous stream). Degrades gracefully if the model
 * can't load.
 */
export function CameraMonitor({
	stream,
	attemptId,
}: {
	stream: MediaStream;
	attemptId: string;
}) {
	const { t } = useTranslation("authoring");
	const videoRef = useRef<HTMLVideoElement>(null);
	const [status, setStatus] = useState<Status>("loading");

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		video.srcObject = stream;
		video.play().catch(() => {});

		let detector: FaceLandmarksDetector | null = null;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let cancelled = false;
		/** Are we currently accusing the learner of something? */
		let flagged = false;
		/** Did the last tick manage to look at all? (false while warming up) */
		let couldLook = false;

		/** One look. Returns the face count, or null if we couldn't look at all. */
		const sample = async (): Promise<number | null> => {
			if (!detector || !video || video.readyState < 2) return null;
			try {
				return (await detector.estimateFaces(video)).length;
			} catch {
				return null;
			}
		};

		const tick = async () => {
			const first = await sample();
			couldLook = first !== null;
			if (first === null) return; // couldn't look — say nothing
			if (first === 1) {
				// Present. Clears any standing flag immediately.
				setStatus("ok");
				flagged = false;
				return;
			}
			// Already flagged and still wrong — nothing new to report, and we
			// don't re-upload a snapshot for the same continuing absence.
			if (flagged) return;

			// Suspicious frame — look again before accusing anyone. Any single
			// clean look clears it: the learner is present, and that's the end of
			// the matter.
			const counts = [first];
			for (let i = 1; i < CONFIRM_SAMPLES && !cancelled; i++) {
				await new Promise((r) => setTimeout(r, CONFIRM_GAP_MS));
				const next = await sample();
				if (next === null) continue;
				if (next === 1) {
					setStatus("ok");
					return;
				}
				counts.push(next);
			}
			if (cancelled) return;

			// Still wrong after ~2s of looking. Flag the majority verdict — a face
			// that never appeared, or a second person who stayed in frame.
			const missing = counts.filter((c) => c === 0).length;
			const isMissing = missing >= counts.length - missing;
			const eventType: AntiCheatEventType = isMissing
				? "camera_face_missing"
				: "camera_multiple_faces";
			setStatus(isMissing ? "missing" : "multiple");
			flagged = true;
			const blob = await captureThumbnail(video);
			if (blob) {
				uploadProctoringSnapshot(attemptId, blob, eventType).catch(() => {});
			}
		};

		// Self-scheduling rather than a fixed interval, so the delay can answer
		// what just happened: come straight back if we never got to look, look
		// often while flagged so the badge clears the moment the learner is back,
		// and otherwise hold the §4.6.2 30s cadence.
		const schedule = () => {
			if (cancelled) return;
			timer = setTimeout(
				async () => {
					await tick();
					schedule();
				},
				!couldLook ? WARMUP_RETRY_MS : flagged ? RECHECK_MS : INTERVAL_MS,
			);
		};

		const loadDetector = async () => {
			const tf = await import("@tensorflow/tfjs");
			await tf.ready();
			const fld = await import("@tensorflow-models/face-landmarks-detection");
			return fld.createDetector(fld.SupportedModels.MediaPipeFaceMesh, {
				runtime: "tfjs",
				maxFaces: 2,
				refineLandmarks: false,
			});
		};

		(async () => {
			for (let attempt = 1; attempt <= LOAD_ATTEMPTS && !cancelled; attempt++) {
				try {
					detector = await loadDetector();
					if (cancelled) {
						detector.dispose();
						detector = null;
						return;
					}
					setStatus("ok");
					await tick();
					schedule();
					return;
				} catch {
					if (attempt < LOAD_ATTEMPTS) {
						await new Promise((r) => setTimeout(r, LOAD_BACKOFF_MS * attempt));
					}
				}
			}
			if (cancelled) return;

			// Out of retries. We do NOT trap the learner — a broken CDN is our fault,
			// not theirs, and blocking a final they've paid for (and whose Earn-Back
			// deadline is ticking) would punish them for it. But we must never
			// pretend: say so on their screen, and put it on the record so this
			// attempt can never be mistaken for a monitored, clean one (§4.6.2).
			setStatus("unavailable");
			// Severity is deliberately omitted: the server assigns `info` itself for
			// system events, and won't accept it from us.
			ingestAntiCheat(attemptId, [
				{ eventType: "camera_monitor_unavailable" },
			]).catch(() => {});
		})();

		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
			detector?.dispose();
		};
	}, [stream, attemptId]);

	const flagged = status === "missing" || status === "multiple";
	// Not an accusation, but not "Monitored" either — the learner is told the
	// truth about what is and isn't watching them.
	const unavailable = status === "unavailable";
	const label =
		status === "loading"
			? t("take.camera_loading", { defaultValue: "Starting camera…" })
			: status === "missing"
				? t("take.camera_missing", { defaultValue: "Face not detected" })
				: status === "multiple"
					? t("take.camera_multiple", { defaultValue: "Multiple faces" })
					: unavailable
						? t("take.camera_unavailable", {
								defaultValue: "Monitoring unavailable",
							})
						: t("take.camera_on", { defaultValue: "Monitored" });

	return (
		<div
			className={cn(
				"fixed bottom-24 left-3 z-20 w-32 overflow-hidden rounded-card border-2 bg-slate-900 shadow-card transition-colors sm:w-40",
				flagged
					? "border-error"
					: unavailable
						? "border-amber-400"
						: "border-white/40",
			)}
		>
			<video
				ref={videoRef}
				muted
				playsInline
				className="aspect-[4/3] w-full scale-x-[-1] object-cover"
			/>
			<div
				className={cn(
					"flex items-center gap-1.5 px-2 py-1 text-white text-xs",
					flagged ? "bg-error" : unavailable ? "bg-amber-600" : "bg-black/60",
				)}
				// Announce the drop to monitoring: it changes what the session is.
				role={unavailable ? "status" : undefined}
			>
				{status === "loading" ? (
					<Loader2 className="size-3 animate-spin" />
				) : unavailable ? (
					<VideoOff className="size-3" />
				) : (
					<Video className="size-3" />
				)}
				<span className="truncate">{label}</span>
			</div>
			{unavailable ? (
				<p className="bg-amber-600/90 px-2 pb-1.5 text-[0.65rem] text-white leading-tight">
					{t("take.camera_unavailable_hint", {
						defaultValue: "Your attempt is recorded as unmonitored.",
					})}
				</p>
			) : null}
		</div>
	);
}
