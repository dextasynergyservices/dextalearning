import { subscribePush, unsubscribePush } from "./push-api";

// Browser web-push (VAPID) helpers. All guard on capability so calling them on
// an unsupported browser (or without a VAPID key) is a safe no-op.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
	| string
	| undefined;

const SW_URL = "/sw.js";

export function isPushSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		"serviceWorker" in navigator &&
		"PushManager" in window &&
		"Notification" in window &&
		Boolean(VAPID_PUBLIC_KEY)
	);
}

export type PushPermission = NotificationPermission | "unsupported";

export function pushPermission(): PushPermission {
	if (!isPushSupported()) return "unsupported";
	return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64);
	const buffer = new ArrayBuffer(raw.length);
	const output = new Uint8Array(buffer);
	for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
	return output;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
	const existing = await navigator.serviceWorker.getRegistration(SW_URL);
	return existing ?? navigator.serviceWorker.register(SW_URL);
}

/** True when this browser currently holds an active push subscription. */
export async function isPushEnabled(): Promise<boolean> {
	if (!isPushSupported() || Notification.permission !== "granted") return false;
	const registration = await navigator.serviceWorker.getRegistration();
	const subscription = await registration?.pushManager.getSubscription();
	return Boolean(subscription);
}

/**
 * Ask for permission, subscribe via the service worker, and persist the
 * subscription. Returns false if unsupported or permission was denied.
 */
export async function enablePush(): Promise<boolean> {
	if (!isPushSupported()) return false;
	const permission = await Notification.requestPermission();
	if (permission !== "granted") return false;

	const registration = await ensureRegistration();
	await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
	});
	const json = subscription.toJSON();
	await subscribePush({
		endpoint: subscription.endpoint,
		keys: {
			p256dh: json.keys?.p256dh ?? "",
			auth: json.keys?.auth ?? "",
		},
	});
	return true;
}

/** Unsubscribe this browser and forget it on the server. */
export async function disablePush(): Promise<void> {
	if (!isPushSupported()) return;
	const registration = await navigator.serviceWorker.getRegistration();
	const subscription = await registration?.pushManager.getSubscription();
	if (subscription) {
		await unsubscribePush(subscription.endpoint).catch(() => {});
		await subscription.unsubscribe().catch(() => {});
	}
}
