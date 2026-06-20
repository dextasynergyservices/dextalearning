import { SetMetadata } from "@nestjs/common";
import type { AuthenticatedUser } from "../types";

export const ROLES_KEY = "roles";

/** Restrict a route/controller to the given roles (enforced by `RolesGuard`). */
export const Roles = (...roles: AuthenticatedUser["role"][]) =>
	SetMetadata(ROLES_KEY, roles);
