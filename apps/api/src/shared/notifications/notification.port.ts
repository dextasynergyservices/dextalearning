/**
 * Outbound notification channels (hexagonal port — §6.4). Contexts depend on
 * this interface, never on Resend/Termii directly; swapping a provider (or
 * adding the Phase 5 web-push channel) touches one adapter, zero contexts.
 */
export const NOTIFICATION_PORT = Symbol("NOTIFICATION_PORT");

export interface NotificationPort {
	/** Sends a pre-rendered HTML email. Degrades to a log in dev (no key). */
	sendEmail(to: string, subject: string, html: string): Promise<void>;
	/**
	 * Sends a short WhatsApp message (SMS fallback handled by the adapter).
	 * Callers are responsible for checking `whatsappOptIn` first.
	 */
	sendWhatsapp(phone: string, message: string): Promise<void>;
	// Phase 5 (blueprint "Push notification opt-in"): sendPush(...) lands here.
}
