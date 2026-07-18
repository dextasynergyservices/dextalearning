import {
	emailOTPClient,
	magicLinkClient,
	twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_AUTH_URL,
	plugins: [
		emailOTPClient(),
		magicLinkClient(),
		// TOTP two-factor (§5.9). On a login that needs a second factor, Better
		// Auth returns `twoFactorRedirect` and this sends the user to /2fa.
		twoFactorClient({
			onTwoFactorRedirect: () => {
				window.location.href = "/2fa";
			},
		}),
	],
});

export const { signUp, signIn, signOut, useSession } = authClient;

/** Post-auth landing per role: staff go to the Creator Studio, learners to the
 *  learner dashboard. */
export function homeForRole(
	role?: string,
): "/admin" | "/instructor" | "/dashboard" {
	if (role === "admin") return "/admin";
	if (role === "instructor") return "/instructor";
	return "/dashboard";
}

/** Only honour internal, single-slash redirect targets — never an open redirect. */
export function safeRedirect(target?: string): string | null {
	if (!target?.startsWith("/") || target.startsWith("//")) return null;
	return target;
}

const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin;

/** Kicks off Google OAuth. Brand-new accounts land on onboarding; returning
 *  users hit the role-aware resolver (/continue) so staff reach their studio,
 *  not the learner dashboard. The Better Auth callback sets the session cookie
 *  before redirecting back. */
export function signInWithGoogle(): Promise<unknown> {
	return authClient.signIn.social({
		provider: "google",
		callbackURL: `${APP_URL}/continue`,
		newUserCallbackURL: `${APP_URL}/onboarding`,
	});
}
