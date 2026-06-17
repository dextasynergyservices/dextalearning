import { Resend } from "resend";

// Resend client (blueprint §5.5). Plain module so Better Auth's config (which
// lives outside Nest's DI container) can call it. Degrades gracefully to logging
// when RESEND_API_KEY is absent, so local dev works without a key.

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

function layout(heading: string, body: string): string {
	return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;background:#f8fafc;font-family:'DM Sans',Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr><td style="background:#0a0a0a;padding:24px 28px;">
          <span style="font-family:'Righteous',Arial,sans-serif;font-size:22px;color:#ffffff;">Dexta<span style="color:#f59e0b;">Learning</span></span>
        </td></tr>
        <tr><td style="padding:32px 28px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;">${heading}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;">
          © ${new Date().getFullYear()} DextaLearning · dextalearning.com
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function button(href: string, label: string): string {
	return `<a href="${href}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;">${label}</a>`;
}

function otpBlock(otp: string): string {
	return `<div style="margin:8px 0 4px;font-family:'Space Grotesk',monospace;font-size:30px;letter-spacing:8px;font-weight:700;color:#1d4ed8;">${otp}</div>`;
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
		layout(
			"Verify your email",
			`<p style="margin:0 0 20px;color:#334155;">Welcome to DextaLearning! Confirm your email to start learning.</p>
       <p style="margin:0 0 24px;">${button(magicLink, "Verify my email")}</p>
       <p style="margin:0 0 4px;color:#64748b;font-size:14px;">Or enter this code (expires in 10 minutes):</p>
       ${otp ? otpBlock(otp) : ""}
       <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;">The link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>`,
		),
	);
}

/** OTP-only email (e.g. resend, code sign-in). */
export async function sendOtpEmail(to: string, otp: string): Promise<void> {
	await send(
		to,
		"Your DextaLearning verification code",
		layout(
			"Your verification code",
			`<p style="margin:0 0 8px;color:#334155;">Enter this code to continue (expires in 10 minutes):</p>
       ${otpBlock(otp)}`,
		),
	);
}

export async function sendMagicLinkEmail(
	to: string,
	url: string,
): Promise<void> {
	await send(
		to,
		"Your DextaLearning sign-in link",
		layout(
			"Sign in to DextaLearning",
			`<p style="margin:0 0 24px;color:#334155;">Click below to sign in. This link expires shortly.</p>
       <p style="margin:0;">${button(url, "Sign in")}</p>`,
		),
	);
}

export async function sendPasswordResetEmail(
	to: string,
	url: string,
): Promise<void> {
	await send(
		to,
		"Reset your DextaLearning password",
		layout(
			"Reset your password",
			`<p style="margin:0 0 24px;color:#334155;">We received a request to reset your password. If it wasn't you, ignore this email.</p>
       <p style="margin:0;">${button(url, "Reset password")}</p>`,
		),
	);
}
