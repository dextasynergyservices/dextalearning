import axios from "axios";

// Termii WhatsApp/SMS OTP (blueprint §5.5). Plain module callable from Better
// Auth's config. Degrades to logging when TERMII_API_KEY is absent.

const apiKey = process.env.TERMII_API_KEY;
const senderId = process.env.TERMII_SENDER_ID ?? "DextaLearning";
const baseUrl = process.env.TERMII_BASE_URL ?? "https://api.ng.termii.com/api";

/** Send a verification OTP over WhatsApp (falls back to SMS channel config). */
export async function sendWhatsappOtp(
	phone: string,
	otp: string,
): Promise<void> {
	if (!apiKey) {
		console.log(`[termii] (no TERMII_API_KEY) WhatsApp OTP ${otp} to ${phone}`);
		return;
	}
	try {
		await axios.post(`${baseUrl}/sms/send`, {
			api_key: apiKey,
			to: phone,
			from: senderId,
			sms: `Your DextaLearning verification code is ${otp}. It expires in 10 minutes.`,
			type: "plain",
			channel: "whatsapp",
		});
	} catch (error) {
		console.error(
			`[termii] failed to send to ${phone}:`,
			error instanceof Error ? error.message : error,
		);
	}
}
