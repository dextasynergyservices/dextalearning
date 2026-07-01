import { useCallback, useEffect, useRef } from "react";
import {
	type AntiCheatEvent,
	type AntiCheatEventType,
	ingestAntiCheat,
} from "@/lib/content-api";

interface UseAntiCheatOptions {
	attemptId: string;
	enabled: boolean;
	copyPasteBlocked: boolean;
	fullscreenRequired: boolean;
	tabSwitchLimit: number;
	/** Called when the server (or local count) signals an auto-submit threshold. */
	onAutoSubmit: () => void;
	/** Called on each tab switch so the UI can warn the learner. */
	onTabSwitch: (count: number, limit: number) => void;
}

// Events that matter enough to flush immediately (drive auto-submit).
const MAJOR: AntiCheatEventType[] = ["tab_switch", "fullscreen_exit"];
const FLUSH_INTERVAL_MS = 8000;

/**
 * Client-side anti-cheat detection (§4.6.1): logs tab switches, copy/paste,
 * right-click, blocked shortcuts, viewport changes and fullscreen exits, batches
 * them to the server (which owns the integrity score + auto-submit threshold),
 * and blocks the configured interactions. The server remains authoritative — the
 * client only reports and reacts.
 */
export function useAntiCheat({
	attemptId,
	enabled,
	copyPasteBlocked,
	fullscreenRequired,
	tabSwitchLimit,
	onAutoSubmit,
	onTabSwitch,
}: UseAntiCheatOptions) {
	const buffer = useRef<AntiCheatEvent[]>([]);
	const tabSwitches = useRef(0);
	const submitted = useRef(false);
	// Keep callbacks current without re-binding listeners.
	const cb = useRef({ onAutoSubmit, onTabSwitch });
	cb.current = { onAutoSubmit, onTabSwitch };

	const flush = useCallback(async () => {
		if (submitted.current || buffer.current.length === 0) return;
		const events = buffer.current;
		buffer.current = [];
		try {
			const ack = await ingestAntiCheat(attemptId, events);
			if (ack.autoSubmit && !submitted.current) {
				submitted.current = true;
				cb.current.onAutoSubmit();
			}
		} catch {
			// Re-queue on failure so events aren't lost.
			buffer.current = [...events, ...buffer.current];
		}
	}, [attemptId]);

	const push = useCallback(
		(eventType: AntiCheatEventType, metadata?: Record<string, unknown>) => {
			buffer.current.push({
				eventType,
				occurredAt: new Date().toISOString(),
				metadata,
			});
			if (MAJOR.includes(eventType)) void flush();
		},
		[flush],
	);

	useEffect(() => {
		if (!enabled) return;

		const onVisibility = () => {
			if (document.visibilityState === "hidden") {
				tabSwitches.current += 1;
				push("tab_switch", { count: tabSwitches.current });
				cb.current.onTabSwitch(tabSwitches.current, tabSwitchLimit);
				if (tabSwitches.current >= tabSwitchLimit && !submitted.current) {
					submitted.current = true;
					cb.current.onAutoSubmit();
				}
			}
		};

		const onContextMenu = (e: MouseEvent) => {
			e.preventDefault();
			push("right_click");
		};

		const onClipboard = (e: ClipboardEvent) => {
			if (!copyPasteBlocked) return;
			e.preventDefault();
			push(e.type === "paste" ? "paste_attempt" : "copy_attempt");
		};

		const onKeyDown = (e: KeyboardEvent) => {
			const k = e.key.toLowerCase();
			const mod = e.ctrlKey || e.metaKey;
			// DevTools.
			if (e.key === "F12" || (mod && e.shiftKey && (k === "i" || k === "j"))) {
				e.preventDefault();
				push("devtools_open");
				return;
			}
			// Blocked shortcuts.
			if (mod && ["c", "v", "a", "u", "s", "p"].includes(k)) {
				if ((k === "c" || k === "v") && !copyPasteBlocked) return;
				e.preventDefault();
				push("keyboard_shortcut", { key: k });
			}
		};

		const initialWidth = window.innerWidth;
		let resizeTimer: ReturnType<typeof setTimeout> | undefined;
		const onResize = () => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				if (Math.abs(window.innerWidth - initialWidth) > 120) {
					push("viewport_change", { width: window.innerWidth });
				}
			}, 400);
		};

		const onFullscreenChange = () => {
			if (fullscreenRequired && !document.fullscreenElement) {
				push("fullscreen_exit");
			}
		};

		document.addEventListener("visibilitychange", onVisibility);
		document.addEventListener("contextmenu", onContextMenu);
		document.addEventListener("copy", onClipboard);
		document.addEventListener("cut", onClipboard);
		document.addEventListener("paste", onClipboard);
		document.addEventListener("keydown", onKeyDown);
		window.addEventListener("resize", onResize);
		document.addEventListener("fullscreenchange", onFullscreenChange);

		// Discourage text selection during the assessment.
		const prevUserSelect = document.body.style.userSelect;
		document.body.style.userSelect = "none";

		// Best-effort fullscreen (works while the start gesture is still fresh).
		if (fullscreenRequired && !document.fullscreenElement) {
			document.documentElement.requestFullscreen?.().catch(() => {});
		}

		const interval = setInterval(() => void flush(), FLUSH_INTERVAL_MS);

		return () => {
			document.removeEventListener("visibilitychange", onVisibility);
			document.removeEventListener("contextmenu", onContextMenu);
			document.removeEventListener("copy", onClipboard);
			document.removeEventListener("cut", onClipboard);
			document.removeEventListener("paste", onClipboard);
			document.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("resize", onResize);
			document.removeEventListener("fullscreenchange", onFullscreenChange);
			document.body.style.userSelect = prevUserSelect;
			clearTimeout(resizeTimer);
			clearInterval(interval);
			void flush();
		};
	}, [
		enabled,
		copyPasteBlocked,
		fullscreenRequired,
		tabSwitchLimit,
		push,
		flush,
	]);

	/** Mark submitted so trailing events/auto-submit are suppressed, then flush. */
	const markSubmitted = useCallback(() => {
		submitted.current = true;
		void flush();
	}, [flush]);

	return { markSubmitted };
}
