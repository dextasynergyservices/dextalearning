import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { useEffect, useMemo, useRef, useState } from "react";

const QUALITY_STORAGE_KEY = "dextalearning_preferred_quality";
const EMPTY_CAPTION_URLS: Record<string, string | null> = {};

const LANG_LABELS: Record<string, string> = {
	en: "English",
	fr: "Français",
	es: "Español",
	pcm: "Naijá",
};

interface VideoPlayerProps {
	/** Presigned URL per quality label, e.g. `{ "1080p": "https://…", … }`. */
	qualities: Record<string, string>;
	defaultQuality?: string;
	/** Presigned .vtt URL per language (null when not provided). */
	captionUrls?: Record<string, string | null>;
	poster?: string;
}

function parseQualitySize(quality: string | undefined): number | null {
	if (!quality) return null;
	const size = Number.parseInt(quality, 10);
	return Number.isNaN(size) ? null : size;
}

/**
 * Protected Plyr video player (§5.6, §5.7): multi-quality switching from the
 * presigned renditions, instructor-uploaded caption tracks, remembers the user's
 * quality choice. No download control (content protection — §5.9 Layer 8).
 *
 * Sources and tracks are set via Plyr's programmatic `player.source` API rather
 * than React-managed `<source>` / `<track>` elements. This avoids the conflict
 * between React's virtual DOM and Plyr's internal DOM manipulation, which caused
 * controls to never render.
 */
export function VideoPlayer({
	qualities,
	defaultQuality = "480p",
	captionUrls = EMPTY_CAPTION_URLS,
	poster,
}: VideoPlayerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const playerRef = useRef<Plyr | null>(null);
	const [ready, setReady] = useState(false);

	const sources = useMemo(
		() =>
			Object.entries(qualities)
				.map(([quality, src]) => ({
					src,
					type: "video/mp4" as const,
					size: parseQualitySize(quality),
				}))
				.filter(
					(s): s is { src: string; type: "video/mp4"; size: number } =>
						Boolean(s.src) && s.size !== null,
				)
				.sort((a, b) => b.size - a.size),
		[qualities],
	);

	const tracks = useMemo(
		() =>
			Object.entries(captionUrls)
				.filter((entry): entry is [string, string] => Boolean(entry[1]))
				.map(([lang, src]) => ({
					kind: "captions" as const,
					label: LANG_LABELS[lang] ?? lang,
					srclang: lang,
					src,
					default: lang === "en",
				})),
		[captionUrls],
	);

	useEffect(() => {
		const wrapper = containerRef.current;
		if (!wrapper || sources.length === 0) return;

		// ── Determine initial quality ───────────────────────────────────────
		const qualityOptions = sources.map((s) => s.size).sort((a, b) => b - a);
		const stored = Number.parseInt(
			localStorage.getItem(QUALITY_STORAGE_KEY) ?? "",
			10,
		);
		const requestedDefault = parseQualitySize(defaultQuality);
		const initialQuality =
			!Number.isNaN(stored) && qualityOptions.includes(stored)
				? stored
				: requestedDefault && qualityOptions.includes(requestedDefault)
					? requestedDefault
					: qualityOptions[0];

		// ── Create a fresh <video> element for Plyr ─────────────────────────
		// Plyr heavily mutates the element it wraps. Giving it a plain element
		// we create ourselves (outside React's tree) avoids any vDOM conflicts.
		const video = document.createElement("video");
		video.className = "aspect-video w-full object-contain";
		video.setAttribute("playsinline", "");
		video.setAttribute("preload", "metadata");
		if (poster) video.setAttribute("poster", poster);
		if (tracks.length > 0) video.setAttribute("crossorigin", "anonymous");
		wrapper.appendChild(video);

		const player = new Plyr(video, {
			captions: { active: true, update: true, language: "auto" },
			quality: { default: initialQuality, options: qualityOptions },
			settings: ["captions", "quality", "speed"],
			tooltips: { controls: true, seek: true },
			controls: [
				"play-large",
				"play",
				"progress",
				"current-time",
				"duration",
				"mute",
				"volume",
				"captions",
				"settings",
				"pip",
				"fullscreen",
			],
		});

		// Set the source programmatically — this is the Plyr-recommended way
		// and guarantees it reads sizes correctly for quality switching.
		player.source = {
			type: "video",
			sources,
			tracks,
			...(poster ? { poster } : {}),
		};

		player.on("qualitychange", () => {
			if (typeof player.quality === "number") {
				localStorage.setItem(QUALITY_STORAGE_KEY, String(player.quality));
			}
		});

		player.on("ready", () => setReady(true));

		playerRef.current = player;

		return () => {
			player.destroy();
			// Plyr.destroy() removes most of its wrapper but may leave the video
			// element; clear the container to avoid orphans on re-mount.
			while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
			playerRef.current = null;
			setReady(false);
		};
	}, [sources, tracks, defaultQuality, poster]);

	return (
		<div className="overflow-hidden rounded-card bg-black shadow-card">
			{/* Plyr mounts into this container; React does not manage the <video>
			    element — it's created imperatively to avoid vDOM/Plyr conflicts. */}
			<div
				ref={containerRef}
				className={`plyr-container${ready ? "" : " opacity-0"}`}
			/>
			{!ready && (
				<div className="flex aspect-video w-full items-center justify-center">
					<div className="size-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
				</div>
			)}
		</div>
	);
}
