/**
 * Outbound notification channels (hexagonal port — §6.4). Contexts depend on
 * this interface, never on Resend/Termii directly; swapping a provider (or
 * adding the Phase 5 web-push channel) touches one adapter, zero contexts.
 */
export const NOTIFICATION_PORT = Symbol("NOTIFICATION_PORT");

/** A browser's web-push (VAPID) subscription, as stored per device. */
export interface WebPushSubscription {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

export interface NotificationPort {
	/** Sends a pre-rendered HTML email. Degrades to a log in dev (no key). */
	sendEmail(to: string, subject: string, html: string): Promise<void>;
	/**
	 * Sends a short WhatsApp message (SMS fallback handled by the adapter).
	 * Callers are responsible for checking `whatsappOptIn` first.
	 */
	sendWhatsapp(phone: string, message: string): Promise<void>;
	/**
	 * Sends a plain SMS (no WhatsApp) — for cases where the learner explicitly
	 * chooses SMS, e.g. phone-number verification.
	 */
	sendSms(phone: string, message: string): Promise<void>;
	/**
	 * Delivers a web-push notification to one browser subscription. `payload` is
	 * a JSON string ({ title, body, url? }). Returns `expired: true` when the
	 * gateway reports the subscription is gone (404/410) so the caller can prune
	 * it. Degrades to a log when VAPID keys are absent.
	 */
	sendPush(
		subscription: WebPushSubscription,
		payload: string,
	): Promise<{ expired: boolean }>;
}
