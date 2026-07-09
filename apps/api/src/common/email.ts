import { Resend } from "resend";
import {
	renderMagicLinkEmail,
	renderOtpEmail,
	renderPasswordResetEmail,
	renderVerifyEmail,
	renderWelcomeEmail,
} from "../emails/render";

// Resend client. Plain module so Better Auth's config (which
// lives outside Nest's DI container) can call it. Degrades gracefully to logging
// when RESEND_API_KEY is absent, so local dev works without a key. Email bodies
// come from React Email templates in `src/emails/`.

const apiKey = process.env.RESEND_API_KEY;
const from =
	process.env.EMAIL_FROM ?? "DextaLearning <noreply@dextalearning.com>";
const resend = apiKey ? new Resend(apiKey) : null;

async function send(to: string, subject: string, html: string): Promise<void> {
	if (!resend) {
		console.log(`[email] (no RESEND_API_KEY) would send "${subject}" to ${to}`);
		return;
	}
	try {
		// The Resend SDK returns `{ error }` instead of throwing on API errors.
		const { error } = await resend.emails.send({ from, to, subject, html });
		if (error) {
			console.error(`[email] Resend rejected send to ${to}:`, error.message);
		}
	} catch (error) {
		console.error(
			`[email] failed to send to ${to}:`,
			error instanceof Error ? error.message : error,
		);
	}
}

/** Single dual-channel verification email: magic link + 6-digit OTP. */
export async function sendVerificationEmail(
	to: string,
	magicLink: string,
	otp: string,
): Promise<void> {
	await send(
		to,
		"Verify your DextaLearning account",
		await renderVerifyEmail({ magicLink, otp }),
	);
}

/** OTP-only email (e.g. resend, code sign-in). */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
	await send(
		to,
		"Your DextaLearning verification code",
		await renderOtpEmail({ otp }),
	);
}

export async function sendMagicLinkEmail(
	to: string,
	url: string,
): Promise<void> {
	await send(
		to,
		"Your DextaLearning sign-in link",
		await renderMagicLinkEmail({ url }),
	);
}

export async function sendPasswordResetEmail(
	to: string,
	url: string,
): Promise<void> {
	await send(
		to,
		"Reset your DextaLearning password",
		await renderPasswordResetEmail({ url }),
	);
}

/**
 * Post-onboarding welcome. Not wired into a flow yet — exported as the
 * foundation for future lifecycle emails (enrolment, earn-back, reminders).
 */
export async function sendWelcomeEmail(
	to: string,
	name?: string,
): Promise<void> {
	await send(
		to,
		"Welcome to DextaLearning",
		await renderWelcomeEmail({ name }),
	);
}

/**
 * Generic pre-rendered send — the surface the `NotificationPort` adapter
 * (Phase 4, §6.4 ports & adapters) delegates to. Callers render their own
 * template (see src/emails/render.tsx) and pass finished HTML.
 */
export async function sendEmail(
	to: string,
	subject: string,
	html: string,
): Promise<void> {
	await send(to, subject, html);
}
