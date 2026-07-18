import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget (§5.9 Layer 2). Renders the challenge and hands
 * its token up via `onToken`; the auth forms send that token in the
 * `x-turnstile-token` header, which the API middleware verifies.
 *
 * Env-gated: without `VITE_TURNSTILE_SITE_KEY` it renders nothing and reports a
 * null token — so local dev, jsdom and Playwright never hit a real challenge,
 * matching the server's no-op when its secret is unset.
 */
declare global {
	interface Window {
		turnstile?: {
			render: (
				el: HTMLElement,
				opts: {
					sitekey: string;
					callback: (token: string) => void;
					"expired-callback"?: () => void;
					"error-callback"?: () => void;
					theme?: "auto" | "light" | "dark";
				},
			) => string;
			remove: (id: string) => void;
		};
	}
}

const SCRIPT_SRC =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
	if (scriptPromise) return scriptPromise;
	scriptPromise = new Promise((resolve, reject) => {
		const s = document.createElement("script");
		s.src = SCRIPT_SRC;
		s.async = true;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error("turnstile script failed"));
		document.head.appendChild(s);
	});
	return scriptPromise;
}

export function TurnstileWidget({
	onToken,
}: {
	onToken: (token: string | null) => void;
}) {
	const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
	const ref = useRef<HTMLDivElement>(null);
	const configured =
		Boolean(siteKey) &&
		!siteKey?.startsWith("your-") &&
		!siteKey?.includes("...");

	// biome-ignore lint/correctness/useExhaustiveDependencies: onToken is a stable setter; re-rendering the widget on its identity would loop.
	useEffect(() => {
		if (!configured || !siteKey) return;
		let widgetId: string | undefined;
		let cancelled = false;

		loadScript()
			.then(() => {
				if (cancelled || !ref.current || !window.turnstile) return;
				widgetId = window.turnstile.render(ref.current, {
					sitekey: siteKey,
					theme: "auto",
					callback: (token) => onToken(token),
					"expired-callback": () => onToken(null),
					"error-callback": () => onToken(null),
				});
			})
			.catch(() => {
				// Script blocked/unreachable: let the form proceed. The server
				// fails open on its side too, so behaviour stays consistent.
				onToken(null);
			});

		return () => {
			cancelled = true;
			if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
		};
	}, [configured, siteKey]);

	if (!configured) return null;
	return <div ref={ref} className="mt-4 flex justify-center" />;
}

/** True when Turnstile is configured — forms use it to require a token. */
export function turnstileEnabled(): boolean {
	const k = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
	return Boolean(k) && !k?.startsWith("your-") && !k?.includes("...");
}
