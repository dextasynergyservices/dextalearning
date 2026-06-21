import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { openAPI } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins/email-otp";
import { magicLink } from "better-auth/plugins/magic-link";
import { PrismaClient } from "../../generated/prisma/client";
import {
	sendMagicLinkEmail,
	sendOtpEmail,
	sendPasswordResetEmail,
	sendVerificationEmail,
} from "../common/email";
import { sendWhatsappOtp } from "../common/termii";

// Better Auth manages its own Prisma client (it is configured outside Nest's DI
// container). Uses the Prisma 7 driver adapter, like PrismaService.
const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
// HTTPS base URL ⇒ production behind TLS, where the web app and API are on
// different origins. There the session cookie must be SameSite=None + Secure or
// the browser drops it on the cross-site get-session call. Dev (http) stays Lax.
const useSecureCookies = baseURL.startsWith("https://");

/**
 * Better Auth instance (blueprint §5.5): email/password + Google OAuth, with a
 * dual-channel verification flow — a magic link AND a 6-digit OTP. The actual
 * delivery (Resend email + Termii WhatsApp) is wired in the next slice; for now
 * the send callbacks log so the flows are exercisable end-to-end.
 */
export const auth = betterAuth({
	appName: "DextaLearning",
	secret:
		process.env.BETTER_AUTH_SECRET ??
		"dev-only-secret-change-me-minimum-32-characters",
	baseURL,
	trustedOrigins: frontendUrl.split(",").map((origin) => origin.trim()),
	database: prismaAdapter(prisma, { provider: "postgresql" }),
	advanced: {
		// Our PK columns are UUID with a `gen_random_uuid()` default — let the
		// database generate the ids instead of Better Auth's string ids.
		database: {
			generateId: false,
		},
		useSecureCookies,
		// Cross-origin session cookie in production (see `useSecureCookies`). Set
		// COOKIE_DOMAIN=".yourdomain.com" to share the cookie across app./api.
		// subdomains of one root domain (recommended over two unrelated domains).
		...(useSecureCookies
			? {
					defaultCookieAttributes: {
						sameSite: "none" as const,
						secure: true,
						httpOnly: true,
						...(process.env.COOKIE_DOMAIN
							? { domain: process.env.COOKIE_DOMAIN }
							: {}),
					},
				}
			: {}),
	},
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 12,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			await sendPasswordResetEmail(user.email, url);
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		sendVerificationEmail: async ({ user, url }) => {
			// One dual-channel email: magic link + a 6-digit OTP (§5.5). Also push
			// the OTP over WhatsApp when the user added a phone.
			let otp = "";
			try {
				const created = (await auth.api.createVerificationOTP({
					body: { email: user.email, type: "email-verification" },
				})) as unknown;
				otp =
					typeof created === "string"
						? created
						: created && typeof created === "object" && "code" in created
							? String((created as { code: unknown }).code)
							: "";
			} catch (error) {
				console.error("[auth] createVerificationOTP failed:", error);
			}
			await sendVerificationEmail(user.email, url, otp);
			const phone = (user as { phone?: string | null }).phone;
			if (phone && otp) {
				await sendWhatsappOtp(phone, otp);
			}
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID ?? "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
			mapProfileToUser: (profile) => ({
				name: profile.name,
				firstName: profile.given_name ?? profile.name?.split(" ")[0] ?? "",
				lastName:
					profile.family_name ??
					profile.name?.split(" ").slice(1).join(" ") ??
					"",
			}),
		},
	},
	user: {
		additionalFields: {
			firstName: { type: "string", required: false },
			lastName: { type: "string", required: false },
			otherNames: { type: "string", required: false },
			phone: { type: "string", required: false },
			role: {
				type: "string",
				required: false,
				defaultValue: "learner",
				input: false,
			},
			language: { type: "string", required: false, defaultValue: "en" },
		},
	},
	plugins: [
		emailOTP({
			otpLength: 6,
			expiresIn: 600,
			sendVerificationOTP: async ({ email, otp }) => {
				await sendOtpEmail(email, otp);
			},
		}),
		magicLink({
			sendMagicLink: async ({ email, url }) => {
				await sendMagicLinkEmail(email, url);
			},
		}),
		openAPI(),
	],
});

export type Auth = typeof auth;
