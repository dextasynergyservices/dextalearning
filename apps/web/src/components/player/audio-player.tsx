import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { Music } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
}

/**
 * Plyr audio player (§4.2) with the instructor-uploaded caption track available
 * for transcript-synced display. Wrapped in a branded card for a native feel.
 *
 * Like VideoPlayer, the <audio> element is created imperatively outside React's
 * tree to avoid vDOM/Plyr conflicts that prevent controls from rendering.
 */
export function AudioPlayer({
	src,
	captionUrls = EMPTY_CAPTION_URLS,
	title,
}: AudioPlayerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [ready, setReady] = useState(false);

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
		if (tracks.length > 0) audio.setAttribute("crossorigin", "anonymous");
		wrapper.appendChild(audio);

		const player = new Plyr(audio, {
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

		return () => {
			player.destroy();
			while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
			setReady(false);
		};
	}, [src, tracks]);

	return (
		<div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
			<div className="mb-4 flex items-center gap-3">
				<span className="flex size-11 items-center justify-center rounded-btn bg-brand-primary-light text-brand-primary">
					<Music className="size-5" />
				</span>
				<p className="font-display text-slate-900">{title ?? "Audio lesson"}</p>
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
