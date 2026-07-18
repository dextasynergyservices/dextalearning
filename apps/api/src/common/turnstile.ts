import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

/**
 * Cloudflare Turnstile bot protection (§5.9 Layer 2). Verifies the widget token
 * the client sends in the `x-turnstile-token` header against Cloudflare's
 * siteverify endpoint. Two entry points share one verifier:
 *  - `turnstileMiddleware` — for the Better Auth routes (login, forget-password)
 *    that bypass Nest; runs before the auth handler, reads only the header so it
 *    never consumes the raw body Better Auth needs.
 *  - `TurnstileGuard` — for Nest routes (registration).
 *
 * Env-gated: without `TURNSTILE_SECRET_KEY` both are no-ops, so local dev,
 * jsdom and Playwright never need a real challenge.
 */
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Better Auth paths (bypass Nest) that accept anonymous input. The client uses
 *  email-OTP password reset, so the forget-password route is the OTP variant. */
const PROTECTED = [
	"/api/auth/sign-in/email",
	"/api/auth/forget-password/email-otp",
];

export function turnstileConfigured(): boolean {
	return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(
	token: string | undefined,
	ip: string | undefined,
): Promise<boolean> {
	const secret = process.env.TURNSTILE_SECRET_KEY;
	if (!secret) return true; // unconfigured ⇒ disabled
	if (!token) return false;
	try {
		const body = new URLSearchParams({ secret, response: token });
		if (ip) body.set("remoteip", ip);
		const res = await fetch(SITEVERIFY, { method: "POST", body });
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch {
		// Cloudflare unreachable: fail OPEN. A bot-protection outage must not
		// lock every user out; the auth rate limit still applies.
		return true;
	}
}

/** Nest guard for registration — the anonymous Nest route (§5.9). */
@Injectable()
export class TurnstileGuard implements CanActivate {
	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (!turnstileConfigured()) return true;
		const req = context.switchToHttp().getRequest<Request>();
		const header = req.headers["x-turnstile-token"];
		const token = Array.isArray(header) ? header[0] : header;
		if (await verifyTurnstile(token, req.ip)) return true;
		throw new ForbiddenException({
			message: "errors.security.turnstile_failed",
			code: token ? "TURNSTILE_FAILED" : "TURNSTILE_REQUIRED",
		});
	}
}

/** Express middleware — mount before the Better Auth handler in main.ts. */
export function turnstileMiddleware() {
	const enabled = turnstileConfigured();
	return (req: Request, res: Response, next: NextFunction): void => {
		if (!enabled || req.method !== "POST") {
			next();
			return;
		}
		const path = req.originalUrl.split("?")[0];
		if (!PROTECTED.includes(path)) {
			next();
			return;
		}

		const header = req.headers["x-turnstile-token"];
		const token = Array.isArray(header) ? header[0] : header;
		const reject = (code: "TURNSTILE_REQUIRED" | "TURNSTILE_FAILED") => {
			res.status(403).json({
				success: false,
				error: {
					code,
					message: "errors.security.turnstile_failed",
					requestId: (req as Request & { id?: string }).id ?? "",
				},
			});
		};
		if (!token) {
			reject("TURNSTILE_REQUIRED");
			return;
		}
		verifyTurnstile(token, req.ip).then(
			(ok) => (ok ? next() : reject("TURNSTILE_FAILED")),
			() => next(), // verify threw despite its own catch — fail open
		);
	};
}
