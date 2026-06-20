import type { Request } from "express";

/** The subset of the Better Auth user we rely on across protected endpoints. */
export interface AuthenticatedUser {
	id: string;
	email: string;
	role: "learner" | "facilitator" | "instructor" | "admin";
	firstName?: string;
	lastName?: string;
	name?: string | null;
	tenantId?: string | null;
}

/** Express request after `SessionGuard` has attached the authenticated user. */
export interface AuthedRequest extends Request {
	user: AuthenticatedUser;
}
