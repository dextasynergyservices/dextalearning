import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { auth } from "../auth.config";
import type { AuthenticatedUser } from "../types";

/**
 * Authenticates a request from its Better Auth session cookie and attaches the
 * resolved user to `req.user`. Reuses the same `auth` instance that serves
 * /api/auth/*, so there is one source of truth for sessions.
 *
 * It also enforces admin suspension (§8.7). This is deliberately checked here
 * rather than only at login: revoking sessions logs a suspended user out, but
 * nothing stops them signing straight back in — a suspension that a re-login
 * defeats isn't a suspension. The cost is one indexed PK lookup on a row
 * `getSession` has already visited.
 */
@Injectable()
export class SessionGuard implements CanActivate {
	constructor(private readonly prisma: PrismaService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context
			.switchToHttp()
			.getRequest<Request & { user?: AuthenticatedUser }>();

		const data = await auth.api.getSession({
			headers: fromNodeHeaders(request.headers),
		});

		if (!data?.session) {
			throw new UnauthorizedException("Authentication required");
		}

		const account = await this.prisma.user.findUnique({
			where: { id: data.user.id },
			select: { suspendedAt: true, suspendedReason: true },
		});
		if (account?.suspendedAt) {
			throw new ForbiddenException({
				message:
					"Your account is suspended. Contact support if you think this is a mistake.",
				code: "ACCOUNT_SUSPENDED",
				// Telling them why is the difference between a suspension and a
				// mysterious outage they'll open three tickets about.
				details: { reason: account.suspendedReason ?? null },
			});
		}

		request.user = data.user as unknown as AuthenticatedUser;
		return true;
	}
}
