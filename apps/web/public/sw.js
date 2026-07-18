/*
 * DextaLearning service worker (§6.1 "PWA — mobile-first, offline cache",
 * §8.6 push channel, Phase 8 D4).
 *
 * Strategies, by what breaks if we get them wrong:
 *  - /assets/*  → cache-first. Vite content-hashes these filenames, so a hit
 *    is immutable by construction; re-downloading them is pure waste.
 *  - navigations → network-first, falling back to the cached app shell. The
 *    SPA renders offline (routes, i18n, theme); data queries fail visibly and
 *    honestly rather than showing stale lessons as fresh.
 *  - static images/fonts → stale-while-revalidate: instant, refreshed behind.
 *  - /api/* GETs → NEVER cached. Auth, money and progress must not be served
 *    stale; §12.6 media URLs are presigned and expire — caching them would
 *    hand out dead links with a straight face.
 *  - POST lesson progress → background sync: a learner finishing a lesson in
 *    a tunnel keeps their progress. Queued in IndexedDB, replayed on `sync`
 *    (or via the REPLAY_QUEUE message the client sends when back online —
 *    iOS has no SyncManager).
 *
 * The push + notificationclick handlers predate this worker and are kept
 * behaviour-identical (§8.6).
 */

const VERSION = "v2";
const SHELL_CACHE = `dexta-shell-${VERSION}`;
const ASSET_CACHE = `dexta-assets-${VERSION}`;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/favicon.svg"];

/** POSTs matching this are queued when the network is away. */
const PROGRESS_PATH = /\/completion\/lessons\/[^/]+\/progress$/;

// ── Install / activate ──────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)),
	);
	// No skipWaiting here: yanking hashed chunks out from under a running page
	// breaks lazy imports mid-session. The client shows an update prompt and
	// sends SKIP_WAITING when the user opts in.
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const names = await caches.keys();
			await Promise.all(
				names
					.filter((n) => n.startsWith("dexta-") && !n.includes(VERSION))
					.map((n) => caches.delete(n)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("message", (event) => {
	if (event.data === "SKIP_WAITING") self.skipWaiting();
	if (event.data === "REPLAY_QUEUE") replayQueue();
});

// ── Fetch strategies ────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);

	// Background-sync the one write that hurts to lose (any origin — the API
	// host differs from the app origin in dev).
	if (event.request.method === "POST" && PROGRESS_PATH.test(url.pathname)) {
		event.respondWith(postProgressWithQueue(event.request));
		return;
	}

	if (event.request.method !== "GET") return;
	// API reads are always live — stale auth/money/progress is worse than none.
	if (url.pathname.startsWith("/api/")) return;
	if (url.origin !== self.location.origin) return;

	if (url.pathname.startsWith("/assets/")) {
		event.respondWith(cacheFirst(event.request));
		return;
	}

	if (event.request.mode === "navigate") {
		event.respondWith(networkFirstShell(event.request));
		return;
	}

	if (/\.(svg|png|jpe?g|webp|woff2?)$/.test(url.pathname)) {
		event.respondWith(staleWhileRevalidate(event.request));
	}
});

async function cacheFirst(request) {
	const cached = await caches.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.ok) {
		const cache = await caches.open(ASSET_CACHE);
		cache.put(request, response.clone());
	}
	return response;
}

async function staleWhileRevalidate(request) {
	const cache = await caches.open(ASSET_CACHE);
	const cached = await cache.match(request);
	const refresh = fetch(request)
		.then((response) => {
			if (response.ok) cache.put(request, response.clone());
			return response;
		})
		.catch(() => cached);
	return cached ?? refresh;
}

async function networkFirstShell(request) {
	try {
		const response = await fetch(request);
		// Keep the shell fresh for the next offline visit.
		if (response.ok) {
			const cache = await caches.open(SHELL_CACHE);
			cache.put("/", response.clone());
		}
		return response;
	} catch {
		// Offline: any route serves the cached SPA shell — the router takes it
		// from there. Better a working app with visible "offline" errors than
		// the browser dinosaur.
		const shell = await caches.match("/");
		if (shell) return shell;
		return new Response("Offline", { status: 503 });
	}
}

// ── Background sync: lesson progress (IndexedDB queue) ─────────────────────

const DB_NAME = "dexta-sync";
const STORE = "progress-queue";

function openQueue() {
	return new Promise((resolve, reject) => {
		const open = indexedDB.open(DB_NAME, 1);
		open.onupgradeneeded = () => {
			open.result.createObjectStore(STORE, { autoIncrement: true });
		};
		open.onsuccess = () => resolve(open.result);
		open.onerror = () => reject(open.error);
	});
}

function queueAdd(entry) {
	return openQueue().then(
		(db) =>
			new Promise((resolve, reject) => {
				const tx = db.transaction(STORE, "readwrite");
				tx.objectStore(STORE).add(entry);
				tx.oncomplete = resolve;
				tx.onerror = () => reject(tx.error);
			}),
	);
}

function queueDrain() {
	return openQueue().then(
		(db) =>
			new Promise((resolve, reject) => {
				const tx = db.transaction(STORE, "readwrite");
				const store = tx.objectStore(STORE);
				const all = store.getAll();
				all.onsuccess = () => {
					store.clear();
					resolve(all.result ?? []);
				};
				all.onerror = () => reject(all.error);
			}),
	);
}

async function postProgressWithQueue(request) {
	const body = await request.clone().text();
	try {
		return await fetch(request);
	} catch {
		// Network is away. Queue the write, ask for a sync, and answer with the
		// standard envelope so the page carries on. `queued` (not `done`) means
		// the UI never celebrates a completion the server hasn't confirmed.
		await queueAdd({ url: request.url, body, queuedAt: Date.now() });
		if (self.registration.sync) {
			try {
				await self.registration.sync.register("sync-progress");
			} catch {
				// Sync registration can be denied; REPLAY_QUEUE still covers us.
			}
		}
		return new Response(
			JSON.stringify({ success: true, data: { queued: true } }),
			{ status: 202, headers: { "Content-Type": "application/json" } },
		);
	}
}

async function replayQueue() {
	const entries = await queueDrain();
	for (let i = 0; i < entries.length; i++) {
		try {
			await fetch(entries[i].url, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: entries[i].body,
			});
		} catch {
			// Still offline — put the rest back and stop; the next sync retries.
			await Promise.all(entries.slice(i).map((entry) => queueAdd(entry)));
			break;
		}
	}
}

self.addEventListener("sync", (event) => {
	if (event.tag === "sync-progress") event.waitUntil(replayQueue());
});

// ── Push channel (§8.6) — behaviour-identical to the v1 worker ──────────────

self.addEventListener("push", (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { body: event.data ? event.data.text() : "" };
	}
	const title = data.title || "DextaLearning";
	event.waitUntil(
		self.registration.showNotification(title, {
			body: data.body || "",
			icon: "/favicon.svg",
			badge: "/favicon.svg",
			tag: data.tag,
			data: { url: data.url || "/" },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event.notification.data?.url || "/";
	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((windowClients) => {
				for (const client of windowClients) {
					if (client.url.includes(url) && "focus" in client) {
						return client.focus();
					}
				}
				return self.clients.openWindow(url);
			}),
	);
});
