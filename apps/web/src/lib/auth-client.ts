import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_AUTH_URL,
	plugins: [emailOTPClient(), magicLinkClient()],
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

const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin;

/** Kicks off Google OAuth. New accounts land on onboarding; the Better Auth
 *  callback sets the session cookie before redirecting back. */
export function signInWithGoogle(): Promise<unknown> {
	return authClient.signIn.social({
		provider: "google",
		callbackURL: `${APP_URL}/onboarding`,
	});
}
