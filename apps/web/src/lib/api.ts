// Thin client for our own NestJS API (the validated, enveloped endpoints under
// `/api/v1`). Better Auth's own routes (login, OAuth, OTP, magic link) are
// handled separately by `auth-client.ts`. Cookies are always included so the
// Better Auth session rides along on same-site requests.

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

/** Unwraps the standard success envelope (blueprint §5.10), throwing the
 *  server's error message on failure so callers can surface it in a toast. */
export async function apiFetch<T>(
	path: string,
	init?: RequestInit,
): Promise<T> {
	const res = await fetch(`${API_URL}${path}`, {
		credentials: "include",
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
	});

	const body = (await res.json().catch(() => null)) as
		| { success: true; data: T }
		| { success: false; error: { message: string } }
		| null;

	if (!res.ok || !body || body.success === false) {
		const message =
			body && body.success === false
				? body.error.message
				: "Something went wrong. Please try again.";
		throw new Error(message);
	}

	return body.data;
}

export interface RegisterPayload {
	firstName: string;
	lastName: string;
	otherNames?: string;
	email: string;
	phone?: string;
	password: string;
	confirmPassword: string;
}

export interface RegisterResult {
	userId: string;
	email: string;
	emailVerified: boolean;
}

/** Calls the server-validated registration endpoint (confirm-password match +
 *  password policy enforced by class-validator), which creates the user via
 *  Better Auth and triggers the verification email. */
export function registerAccount(
	payload: RegisterPayload,
): Promise<RegisterResult> {
	return apiFetch<RegisterResult>("/auth/register", {
		method: "POST",
		body: JSON.stringify(payload),
	});
}
