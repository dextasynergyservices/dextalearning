import type {
	NotificationPort,
	WebPushSubscription,
} from "../../../../src/shared/notifications/notification.port";

/**
 * In-memory `NotificationPort` — captures channel sends for assertion, with
 * opt-in failure injection so "channel failures never throw" is testable.
 */
export class FakeNotificationAdapter implements NotificationPort {
	emails: { to: string; subject: string; html: string }[] = [];
	whatsapps: { phone: string; message: string }[] = [];
	smses: { phone: string; message: string }[] = [];
	pushes: { subscription: WebPushSubscription; payload: string }[] = [];
	failEmail = false;
	failWhatsapp = false;
	failSms = false;
	/** Endpoints the fake gateway reports as gone (410) so pruning is testable. */
	expiredEndpoints = new Set<string>();

	async sendEmail(to: string, subject: string, html: string): Promise<void> {
		if (this.failEmail) throw new Error("email provider down");
		this.emails.push({ to, subject, html });
	}

	async sendWhatsapp(phone: string, message: string): Promise<void> {
		if (this.failWhatsapp) throw new Error("whatsapp provider down");
		this.whatsapps.push({ phone, message });
	}

	async sendSms(phone: string, message: string): Promise<void> {
		if (this.failSms) throw new Error("sms provider down");
		this.smses.push({ phone, message });
	}

	async sendPush(
		subscription: WebPushSubscription,
		payload: string,
	): Promise<{ expired: boolean }> {
		this.pushes.push({ subscription, payload });
		return { expired: this.expiredEndpoints.has(subscription.endpoint) };
	}

	reset(): void {
		this.emails = [];
		this.whatsapps = [];
		this.smses = [];
		this.pushes = [];
		this.failEmail = false;
		this.failWhatsapp = false;
		this.failSms = false;
		this.expiredEndpoints = new Set();
	}
}
