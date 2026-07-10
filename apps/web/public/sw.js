/*
 * Push-only service worker (§8.6 push channel). Deliberately minimal — the full
 * PWA service worker (offline cache, background sync) is Phase 8. This handles
 * only `push` (show the notification) and `notificationclick` (focus/open the
 * deep-linked page).
 */

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
	const url = (event.notification.data && event.notification.data.url) || "/";
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
