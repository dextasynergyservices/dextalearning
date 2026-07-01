import axios from "axios";

// Termii WhatsApp / SMS. Plain module callable from Better
// Auth's config and (later) the NotificationPort adapter. Degrades to logging
// when TERMII_API_KEY is absent, so local dev works without a key. WhatsApp is
// the primary channel with an SMS fallback.

const apiKey = process.env.TERMII_API_KEY;
const senderId = process.env.TERMII_SENDER_ID ?? "DextaLearning";
const baseUrl = process.env.TERMII_BASE_URL ?? "https://api.ng.termii.com/api";

/** Termii delivery channels: `dnd`/`generic` are SMS routes, `whatsapp` is WA. */
type Channel = "whatsapp" | "generic" | "dnd";

/** Returns true only when actually handed to Termii (false = no key or error). */
async function send(
	to: string,
	message: string,
	channel: Channel,
): Promise<boolean> {
	if (!apiKey) {
		console.log(`[termii] (no TERMII_API_KEY) ${channel} → ${to}: ${message}`);
		return false;
	}
	try {
		await axios.post(`${baseUrl}/sms/send`, {
			api_key: apiKey,
			to,
			from: senderId,
			sms: message,
			type: "plain",
			channel,
		});
		return true;
	} catch (error) {
		console.error(
			`[termii] ${channel} send to ${to} failed:`,
			error instanceof Error ? error.message : error,
		);
		return false;
	}
}

/** WhatsApp first, SMS fallback if the WhatsApp send fails (live keys only). */
async function sendWithFallback(to: string, message: string): Promise<void> {
	const delivered = await send(to, message, "whatsapp");
	if (!delivered && apiKey) await send(to, message, "generic");
}

/** Verification OTP over WhatsApp (SMS fallback). Used by Better Auth sign-up. */
export async function sendWhatsappOtp(
	phone: string,
	otp: string,
): Promise<void> {
	await sendWithFallback(
		phone,
		`Your DextaLearning verification code is ${otp}. It expires in 10 minutes.`,
	);
}

/**
 * Generic transactional notification over WhatsApp (SMS fallback) — the
 * foundation for future notices (enrolment confirmations, earn-back credited,
 * streak/deadline reminders, payout alerts.
 */
export async function sendWhatsappNotification(
	phone: string,
	message: string,
): Promise<void> {
	await sendWithFallback(phone, message);
}

/** Plain SMS (no WhatsApp), e.g. where WhatsApp isn't appropriate. */
export async function sendSms(phone: string, message: string): Promise<void> {
	await send(phone, message, "generic");
}
