import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { openAPI } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins/email-otp";
import { magicLink } from "better-auth/plugins/magic-link";
import { twoFactor } from "better-auth/plugins/two-factor";
import Redis from "ioredis";
import { PrismaClient } from "../../generated/prisma/client";
import {
	sendMagicLinkEmail,
	sendOtpEmail,
	sendPasswordResetEmail,
	sendVerificationEmail,
	sendWelcomeEmail,
} from "../common/email";
import { isDistributedRuntime } from "../common/runtime";
import { sendWhatsappOtp } from "../common/termii";

// Better Auth manages its own Prisma client (it is configured outside Nest's DI
// container). Uses the Prisma 7 driver adapter, like PrismaService.
const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Better Auth's `secondaryStorage` — MULTI-INSTANCE only. When set, Better Auth
 * keeps not just rate-limit counters there but SESSIONS too, so every
 * authenticated request would read the session from Redis. On the single
 * free-tier instance that would spend a Redis command on every request and blow
 * the 500k/month cap (see runtime.ts) — so it is gated on `REDIS_DISTRIBUTED`,
 * NOT on `REDIS_URL`. Single instance: sessions live in the DB and the auth
 * rate limiter uses Better Auth's own in-memory store, both correct here.
 */
const authRedis = isDistributedRuntime()
	? new Redis(process.env.REDIS_URL as string, {
			maxRetriesPerRequest: 2,
			retryStrategy: (times) =>
				times > 5 ? null : Math.min(times * 200, 1000),
		})
	: null;
authRedis?.on("error", () => {
	// Best-effort: a Redis blip must not take auth down. Better Auth falls back
	// to allowing the request; the global IP guard still applies.
});

const secondaryStorage = authRedis
	? {
			get: (key: string) => authRedis.get(key),
			set: async (key: string, value: string, ttl?: number) => {
				if (ttl) await authRedis.set(key, value, "EX", ttl);
				else await authRedis.set(key, value);
			},
			delete: async (key: string) => {
				await authRedis.del(key);
			},
		}
	: undefined;

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
// HTTPS base URL ⇒ production behind TLS, where the web app and API are on
// different origins. There the session cookie must be SameSite=None + Secure or
// the browser drops it on the cross-site get-session call. Dev (http) stays Lax.
const useSecureCookies = baseURL.startsWith("https://");

/**
 * Better Auth instance: email/password + Google OAuth, with a
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
	...(secondaryStorage ? { secondaryStorage } : {}),
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
	// §5.9 Layer 1 (auth): Better Auth's own limiter, since these routes never
	// reach Nest's guard. A loose 100/60s window overall, tightened to 5/60s on
	// the credential + reset paths that brute-force actually targets. Counted in
	// memory on the single free-tier instance; shared across replicas only when
	// `secondaryStorage` (Redis) is enabled under REDIS_DISTRIBUTED (see above).
	rateLimit: {
		enabled: process.env.NODE_ENV !== "test",
		window: 60,
		max: 100,
		// Paths are matched exactly (no prefixing) against the route relative to
		// the auth base — so these list the email-OTP variants the client uses.
		customRules: {
			"/sign-in/email": { window: 60, max: 5 },
			"/sign-up/email": { window: 60, max: 5 },
			"/forget-password/email-otp": { window: 60, max: 5 },
			"/email-otp/reset-password": { window: 60, max: 5 },
			"/two-factor/verify-totp": { window: 60, max: 5 },
			"/two-factor/verify-backup-code": { window: 60, max: 5 },
		},
	},
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 12,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			await sendPasswordResetEmail(user.email, url);
		},
	},
	account: {
		// If a learner registered with email+password and later signs in with
		// Google (same, already-verified email), link the Google account to the
		// existing user instead of erroring or creating a duplicate. Linking is
		// gated to verified emails (Google is not in `trustedProviders`), which
		// blocks the unverified-squatter takeover vector.
		accountLinking: { enabled: true },
	},
	emailVerification: {
		sendOnSignUp: true,
		sendVerificationEmail: async ({ user, url }) => {
			// One dual-channel email: magic link + a 6-digit OTP. Also push
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
		// Account verified & ready (email/password flow) → welcome email.
		afterEmailVerification: async (user) => {
			await sendWelcomeEmail(
				user.email,
				(user as { firstName?: string }).firstName ?? user.name,
			);
		},
	},
	databaseHooks: {
		user: {
			create: {
				// Self-service sign-up may pick learner or instructor only; admin /
				// facilitator are granted out-of-band, never self-assigned.
				before: async (user) => {
					const requested = (user as { role?: string }).role;
					const role = requested === "instructor" ? "instructor" : "learner";
					return { data: { ...user, role } };
				},
				// OAuth sign-ups arrive already verified (no email step) — welcome
				// them here; email/password users get it from afterEmailVerification.
				after: async (user) => {
					if ((user as { emailVerified?: boolean }).emailVerified) {
						await sendWelcomeEmail(
							user.email,
							(user as { firstName?: string }).firstName ?? user.name,
						);
					}
				},
			},
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
				// Accepted at sign-up, but clamped to learner|instructor by the
				// create hook below — privileged roles are never self-grantable.
				input: true,
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
		// §5.9 Layer 6: opt-in TOTP two-factor (authenticator app) + backup
		// codes. `issuer` is what shows in the authenticator app. The plugin adds
		// its own tables (twoFactor secret + backup codes) — applied via raw SQL
		// ALTER, never `db push` (would drop content_embeddings, see memory).
		twoFactor({
			issuer: process.env.PLATFORM_NAME ?? "DextaLearning",
		}),
		openAPI(),
	],
});

export type Auth = typeof auth;
