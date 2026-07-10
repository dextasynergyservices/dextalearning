import webpush from "web-push";
import type { WebPushSubscription } from "../shared/notifications/notification.port";

// Web-push (VAPID) sender. Plain module callable from the NotificationPort
// adapter. Degrades to logging when VAPID keys are absent, so local dev works
// without them. Configured once at import.

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? "mailto:tech@dextalearning.com";
const configured = Boolean(publicKey && privateKey);

if (configured && publicKey && privateKey) {
	webpush.setVapidDetails(subject, publicKey, privateKey);
}

/**
 * Push one notification to a browser subscription. Returns `expired: true` when
 * the push service reports the subscription is gone (404/410) so the caller can
 * delete it; other failures are logged and swallowed.
 */
export async function sendWebPush(
	subscription: WebPushSubscription,
	payload: string,
): Promise<{ expired: boolean }> {
	if (!configured) {
		console.log(
			`[web-push] (no VAPID_* keys) → ${subscription.endpoint.slice(0, 40)}…`,
		);
		return { expired: false };
	}
	try {
		await webpush.sendNotification(subscription, payload);
		return { expired: false };
	} catch (error) {
		const status = (error as { statusCode?: number }).statusCode;
		if (status === 404 || status === 410) return { expired: true };
		console.error(
			"[web-push] send failed:",
			error instanceof Error ? error.message : error,
		);
		return { expired: false };
	}
}
