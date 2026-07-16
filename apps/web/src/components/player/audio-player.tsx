import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { Music } from "lucide-react";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";

const EMPTY_CAPTION_URLS: Record<string, string | null> = {};

const LANG_LABELS: Record<string, string> = {
	en: "English",
	fr: "Français",
	es: "Español",
	pcm: "Naijá",
};

interface AudioPlayerProps {
	src: string;
	captionUrls?: Record<string, string | null>;
	title?: string;
	/** Reports listened fraction (0–100) on progress + 100 on end. */
	onProgress?: (pct: number) => void;
	/** Resume position as a fraction (0–100) of duration; seeks once on load. */
	resumePct?: number;
	/** Reports current playback time (seconds) — drives the synced transcript. */
	onTime?: (seconds: number) => void;
	/** Receives a seek(seconds) fn so the transcript can scrub the player. */
	seekRef?: RefObject<((seconds: number) => void) | null>;
}

/**
 * Plyr audio player with the instructor-uploaded caption track available
 * for transcript-synced display. Wrapped in a branded card for a native feel.
 *
 * Like VideoPlayer, the <audio> element is created imperatively outside React's
 * tree to avoid vDOM/Plyr conflicts that prevent controls from rendering.
 */
export function AudioPlayer({
	src,
	captionUrls = EMPTY_CAPTION_URLS,
	title,
	onProgress,
	resumePct = 0,
	onTime,
	seekRef,
}: AudioPlayerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [ready, setReady] = useState(false);
	const onProgressRef = useRef(onProgress);
	onProgressRef.current = onProgress;
	const onTimeRef = useRef(onTime);
	onTimeRef.current = onTime;
	const resumeRef = useRef(resumePct);
	resumeRef.current = resumePct;

	const tracks = useMemo(
		() =>
			Object.entries(captionUrls)
				.filter((entry): entry is [string, string] => Boolean(entry[1]))
				.map(([lang, url]) => ({
					kind: "captions" as const,
					label: LANG_LABELS[lang] ?? lang,
					srclang: lang,
					src: url,
					default: lang === "en",
				})),
		[captionUrls],
	);

	useEffect(() => {
		const wrapper = containerRef.current;
		if (!wrapper || !src) return;

		// Create a plain <audio> element outside React's tree.
		const audio = document.createElement("audio");
		audio.className = "w-full";
		// Content protection: strip the native download / "save
		// audio as" affordances (deterrent — the presigned URL is still reachable
		// via devtools within its 2h window).
		audio.setAttribute("controlsList", "nodownload");
		audio.oncontextmenu = (event) => event.preventDefault();
		if (tracks.length > 0) audio.setAttribute("crossorigin", "anonymous");
		wrapper.appendChild(audio);

		const player = new Plyr(audio, {
			// Plyr otherwise preloads a placeholder from cdn.plyr.io, which trips a
			// harmless CORS console error; we have a real source, so disable it.
			blankVideo: "",
			controls: [
				"play",
				"progress",
				"current-time",
				"duration",
				"mute",
				"volume",
				"captions",
				"settings",
			],
			settings: ["captions", "speed"],
		});

		player.source = {
			type: "audio",
			sources: [{ src, type: "audio/mp4" }],
			tracks,
		};

		player.on("ready", () => setReady(true));
		let resumed = false;
		player.on("loadedmetadata", () => {
			const pct = resumeRef.current;
			if (!resumed && pct > 1 && pct < 98 && player.duration > 0) {
				player.currentTime = (pct / 100) * player.duration;
				resumed = true;
			}
		});
		player.on("timeupdate", () => {
			onTimeRef.current?.(player.currentTime);
			if (player.duration > 0) {
				onProgressRef.current?.(
					Math.min(100, (player.currentTime / player.duration) * 100),
				);
			}
		});
		player.on("ended", () => onProgressRef.current?.(100));
		if (seekRef) {
			seekRef.current = (seconds: number) => {
				player.currentTime = seconds;
				void player.play();
			};
		}

		return () => {
			player.destroy();
			while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
			if (seekRef) seekRef.current = null;
			setReady(false);
		};
	}, [src, tracks, seekRef]);

	return (
		<div className="rounded-card border border-border bg-card p-5 shadow-card">
			<div className="mb-4 flex items-center gap-3">
				<span className="flex size-11 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
					<Music className="size-5" />
				</span>
				<p className="font-display text-foreground">
					{title ?? "Audio lesson"}
				</p>
			</div>
			<div ref={containerRef} className={ready ? "" : "opacity-0"} />
			{!ready && (
				<div className="flex h-12 items-center justify-center">
					<div className="size-5 animate-spin rounded-full border-2 border-brand-primary/20 border-t-brand-primary" />
				</div>
			)}
		</div>
	);
}
