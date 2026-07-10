import { apiFetch } from "./api";

export interface PushSubscriptionPayload {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

/** Register this browser's push subscription with the API. */
export const subscribePush = (sub: PushSubscriptionPayload) =>
	apiFetch<{ ok: true }>("/notifications/push/subscribe", {
		method: "POST",
		body: JSON.stringify(sub),
	});

/** Remove this browser's push subscription. */
export const unsubscribePush = (endpoint: string) =>
	apiFetch<{ ok: true }>("/notifications/push/unsubscribe", {
		method: "POST",
		body: JSON.stringify({ endpoint }),
	});
