import { Injectable } from "@nestjs/common";
import { sendEmail } from "../../common/email";
import { sendWhatsappNotification } from "../../common/termii";
import type { NotificationPort } from "./notification.port";

/**
 * Resend (email) + Termii (WhatsApp with SMS fallback) implementation of the
 * `NotificationPort`. Both underlying wrappers degrade to console logs when
 * their API keys are absent — the expected dev/test behavior.
 */
@Injectable()
export class ResendTermiiAdapter implements NotificationPort {
	async sendEmail(to: string, subject: string, html: string): Promise<void> {
		await sendEmail(to, subject, html);
	}

	async sendWhatsapp(phone: string, message: string): Promise<void> {
		await sendWhatsappNotification(phone, message);
	}
}
