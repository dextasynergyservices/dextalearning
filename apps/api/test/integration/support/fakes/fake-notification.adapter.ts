import type { NotificationPort } from "../../../../src/shared/notifications/notification.port";

/**
 * In-memory `NotificationPort` — captures channel sends for assertion, with
 * opt-in failure injection so "channel failures never throw" is testable.
 */
export class FakeNotificationAdapter implements NotificationPort {
	emails: { to: string; subject: string; html: string }[] = [];
	whatsapps: { phone: string; message: string }[] = [];
	failEmail = false;
	failWhatsapp = false;

	async sendEmail(to: string, subject: string, html: string): Promise<void> {
		if (this.failEmail) throw new Error("email provider down");
		this.emails.push({ to, subject, html });
	}

	async sendWhatsapp(phone: string, message: string): Promise<void> {
		if (this.failWhatsapp) throw new Error("whatsapp provider down");
		this.whatsapps.push({ phone, message });
	}

	reset(): void {
		this.emails = [];
		this.whatsapps = [];
		this.failEmail = false;
		this.failWhatsapp = false;
	}
}
