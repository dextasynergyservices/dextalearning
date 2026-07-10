import { apiFetch } from "./api";

export type VerificationChannel = "whatsapp" | "sms";

export interface SendCodeResult {
	status: "sent" | "already_verified";
	channel?: VerificationChannel;
	expiresInSeconds?: number;
	resendInSeconds?: number;
}

export interface VerifyCodeResult {
	status: "verified";
}

/** Ask the API to send a verification code to the saved phone number. */
export function sendPhoneCode(
	channel: VerificationChannel = "whatsapp",
): Promise<SendCodeResult> {
	return apiFetch<SendCodeResult>("/phone-verification/send", {
		method: "POST",
		body: JSON.stringify({ channel }),
	});
}

/** Confirm a 6-digit code; on success the phone becomes verified. */
export function verifyPhoneCode(code: string): Promise<VerifyCodeResult> {
	return apiFetch<VerifyCodeResult>("/phone-verification/verify", {
		method: "POST",
		body: JSON.stringify({ code }),
	});
}
