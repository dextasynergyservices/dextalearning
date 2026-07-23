import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

/** The header the web sets from the current `/:academy/...` route. */
export const ACADEMY_HEADER = "x-academy";

/**
 * Extracts the current academy slug from the `x-academy` request header (set by
 * the web from the `/:academy/...` route), or `undefined` when the request is
 * academy-agnostic (the global homepage, cross-academy search). Controllers pass
 * it to their query service, which resolves it to a tenant id and scopes reads.
 * Kept as a plain header read (no DB) so it's synchronous and dependency-free;
 * resolution + isolation live in the domain service.
 */
export const AcademySlug = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): string | undefined => {
		const req = ctx.switchToHttp().getRequest<Request>();
		const raw = req.headers[ACADEMY_HEADER];
		const value = Array.isArray(raw) ? raw[0] : raw;
		const trimmed = value?.trim();
		return trimmed ? trimmed : undefined;
	},
);
