/**
 * PWA registration (§6.1, Phase 8 D4). Production-only on purpose: a caching
 * service worker under Vite dev/HMR serves yesterday's modules and turns
 * every dev session into a cache-debugging session — and Playwright drives
 * the dev stack, so tests stay deterministic too. The push flow (lib/push.ts)
 * registers the same /sw.js on demand, so push keeps working in dev.
 */

/** Called when a new version is installed and waiting to take over. */
export type UpdatePrompt = (activate: () => void) => void;

export function registerPWA(onUpdate: UpdatePrompt): void {
	if (!import.meta.env.PROD) return;
	if (!("serviceWorker" in navigator)) return;

	window.addEventListener("load", async () => {
		try {
			const registration = await navigator.serviceWorker.register("/sw.js");

			// New worker already waiting (page was open across a deploy).
			if (registration.waiting) notify(registration.waiting, onUpdate);

			registration.addEventListener("updatefound", () => {
				const fresh = registration.installing;
				if (!fresh) return;
				fresh.addEventListener("statechange", () => {
					// `installed` + an existing controller ⇒ an UPDATE, not first
					// install — only then is there anything to prompt about.
					if (
						fresh.state === "installed" &&
						navigator.serviceWorker.controller
					) {
						notify(fresh, onUpdate);
					}
				});
			});

			// The user accepted the update: the new worker took control — load
			// the new hashed chunks instead of 404ing on the old ones.
			let reloading = false;
			navigator.serviceWorker.addEventListener("controllerchange", () => {
				if (reloading) return;
				reloading = true;
				window.location.reload();
			});

			// iOS has no Background Sync: when connectivity returns, ask the
			// worker to replay the queued lesson-progress writes explicitly.
			window.addEventListener("online", () => {
				registration.active?.postMessage("REPLAY_QUEUE");
			});
		} catch {
			// Registration failing must never break the app — it just means no
			// offline support this session.
		}
	});
}

function notify(worker: ServiceWorker, onUpdate: UpdatePrompt): void {
	onUpdate(() => worker.postMessage("SKIP_WAITING"));
}
