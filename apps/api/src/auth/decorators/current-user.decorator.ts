import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../types";

/** Injects the authenticated user attached by `SessionGuard`. */
export const CurrentUser = createParamDecorator(
	(_data: unknown, context: ExecutionContext): AuthenticatedUser => {
		return context.switchToHttp().getRequest<{ user: AuthenticatedUser }>()
			.user;
	},
);
