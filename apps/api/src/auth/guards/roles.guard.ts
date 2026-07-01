import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedUser } from "../types";

/**
 * Enforces `@Roles(...)`. Runs after `SessionGuard`, so `req.user` is present.
 * Admin passes every role gate (full-platform authority).
 */
@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const required = this.reflector.getAllAndOverride<
			AuthenticatedUser["role"][] | undefined
		>(ROLES_KEY, [context.getHandler(), context.getClass()]);

		if (!required || required.length === 0) return true;

		const { user } = context
			.switchToHttp()
			.getRequest<{ user?: AuthenticatedUser }>();

		if (!user || (user.role !== "admin" && !required.includes(user.role))) {
			throw new ForbiddenException("Insufficient permissions");
		}
		return true;
	}
}
