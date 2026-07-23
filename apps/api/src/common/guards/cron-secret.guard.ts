import { timingSafeEqual } from "node:crypto";
import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import type { Request } from "express";

/** Header the external scheduler presents. Never put the secret in the URL —
 *  query strings end up in access logs, proxies and browser history. */
const HEADER = "x-cron-secret";

/**
 * Authenticates the scheduled-sweep endpoints for a MACHINE caller (cron-job.org,
 * GitHub Actions), which has no session and no user.
 *
 * Fails CLOSED: if `CRON_SECRET` is unset the endpoints are refused outright
 * rather than left open. An unset secret is a misconfiguration, and the safe
 * reading of "no secret configured" is "nobody may call this" — the opposite
 * would silently expose sweeps that move money.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const expected = process.env.CRON_SECRET;
		if (!expected) {
			throw new ForbiddenException({
				message: "Scheduled sweeps are not configured on this deployment.",
				code: "CRON_SECRET_UNSET",
			});
		}
		const request = context.switchToHttp().getRequest<Request>();
		const provided = request.headers[HEADER];
		if (typeof provided !== "string" || !safeEqual(provided, expected)) {
			throw new ForbiddenException({
				message: "Invalid scheduler credentials.",
				code: "CRON_SECRET_INVALID",
			});
		}
		return true;
	}
}

/** Constant-time compare, length-safe (timingSafeEqual throws on a mismatch). */
function safeEqual(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
}
