import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { auth } from "../auth.config";
import type { AuthenticatedUser } from "../types";

/**
 * Authenticates a request from its Better Auth session cookie and attaches the
 * resolved user to `req.user`. Reuses the same `auth` instance that serves
 * /api/auth/*, so there is one source of truth for sessions.
 */
@Injectable()
export class SessionGuard implements CanActivate {
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

		request.user = data.user as unknown as AuthenticatedUser;
		return true;
	}
}
