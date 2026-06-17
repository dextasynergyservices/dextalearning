import { emailOTPClient, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_AUTH_URL,
	plugins: [emailOTPClient(), magicLinkClient()],
});

export const { signUp, signIn, signOut, useSession } = authClient;

const APP_URL = import.meta.env.VITE_APP_URL ?? window.location.origin;

/** Kicks off Google OAuth. New accounts land on onboarding; the Better Auth
 *  callback sets the session cookie before redirecting back. */
export function signInWithGoogle(): Promise<unknown> {
	return authClient.signIn.social({
		provider: "google",
		callbackURL: `${APP_URL}/onboarding`,
	});
}
