import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
} from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { auth } from "../auth.config";
import type { AuthenticatedUser } from "../types";

/**
 * Like {@link SessionGuard}, but never rejects — it attaches the user to
 * `req.user` when a valid session cookie is present and otherwise lets the
 * request through anonymously. For public endpoints that personalise when the
 * caller happens to be signed in (e.g. recommendations).
 */
@Injectable()
export class OptionalSessionGuard implements CanActivate {
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context
			.switchToHttp()
			.getRequest<Request & { user?: AuthenticatedUser }>();
		const data = await auth.api.getSession({
			headers: fromNodeHeaders(request.headers),
		});
		if (data?.session) {
			request.user = data.user as unknown as AuthenticatedUser;
		}
		return true;
	}
}
