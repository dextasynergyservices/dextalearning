import type { FaceLandmarksDetector } from "@tensorflow-models/face-landmarks-detection";
import { Loader2, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	type AntiCheatEventType,
	uploadProctoringSnapshot,
} from "@/lib/content-api";
import { cn } from "@/lib/utils";

// §4.6.2: analyse the camera at 30-second intervals (client-side only).
const INTERVAL_MS = 30_000;

type Status = "loading" | "ok" | "missing" | "multiple";

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
		let interval: ReturnType<typeof setInterval> | undefined;
		let cancelled = false;

		const tick = async () => {
			if (!detector || !video || video.readyState < 2) return;
			let count = 1;
			try {
				const faces = await detector.estimateFaces(video);
				count = faces.length;
			} catch {
				return;
			}
			if (count === 1) {
				setStatus("ok");
				return;
			}
			const eventType: AntiCheatEventType =
				count === 0 ? "camera_face_missing" : "camera_multiple_faces";
			setStatus(count === 0 ? "missing" : "multiple");
			const blob = await captureThumbnail(video);
			if (blob) {
				uploadProctoringSnapshot(attemptId, blob, eventType).catch(() => {});
			}
		};

		(async () => {
			try {
				const tf = await import("@tensorflow/tfjs");
				await tf.ready();
				const fld = await import("@tensorflow-models/face-landmarks-detection");
				detector = await fld.createDetector(
					fld.SupportedModels.MediaPipeFaceMesh,
					{ runtime: "tfjs", maxFaces: 2, refineLandmarks: false },
				);
				if (cancelled) {
					detector.dispose();
					detector = null;
					return;
				}
				setStatus("ok");
				await tick();
				interval = setInterval(() => void tick(), INTERVAL_MS);
			} catch {
				// Model failed to load — don't trap the learner; server still owns timing.
				setStatus("ok");
			}
		})();

		return () => {
			cancelled = true;
			if (interval) clearInterval(interval);
			detector?.dispose();
		};
	}, [stream, attemptId]);

	const flagged = status === "missing" || status === "multiple";
	const label =
		status === "loading"
			? t("take.camera_loading", { defaultValue: "Starting camera…" })
			: status === "missing"
				? t("take.camera_missing", { defaultValue: "Face not detected" })
				: status === "multiple"
					? t("take.camera_multiple", { defaultValue: "Multiple faces" })
					: t("take.camera_on", { defaultValue: "Monitored" });

	return (
		<div
			className={cn(
				"fixed bottom-24 left-3 z-20 w-32 overflow-hidden rounded-card border-2 bg-slate-900 shadow-card transition-colors sm:w-40",
				flagged ? "border-error" : "border-white/40",
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
					flagged ? "bg-error" : "bg-black/60",
				)}
			>
				{status === "loading" ? (
					<Loader2 className="size-3 animate-spin" />
				) : (
					<Video className="size-3" />
				)}
				<span className="truncate">{label}</span>
			</div>
		</div>
	);
}
