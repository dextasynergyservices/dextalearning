import {
	type CanActivate,
	type ExecutionContext,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
} from "@nestjs/common";
import type { AuthedRequest } from "../../auth/types";
import { CACHE_PORT, type CachePort } from "../../shared/cache/cache.port";

/** Hard daily cap on AI generations per user — the cost ceiling (§5). */
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? 150);
const ONE_DAY_SECONDS = 24 * 60 * 60;

/**
 * Caps how many AI generations one learner can trigger per UTC day, counted in
 * Redis so the ceiling holds across instances. Runs AFTER `SessionGuard` (needs
 * `req.user`). Fail-open: a cache outage never locks anyone out. Skipped under
 * NODE_ENV=test.
 */
@Injectable()
export class AiQuotaGuard implements CanActivate {
	constructor(@Inject(CACHE_PORT) private readonly cache: CachePort) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (process.env.NODE_ENV === "test") return true;
		const req = context.switchToHttp().getRequest<AuthedRequest>();
		const userId = req.user?.id;
		if (!userId) return true; // SessionGuard owns auth; nothing to meter

		const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
		const count = await this.cache.incr(
			`aiquota:${userId}:${day}`,
			ONE_DAY_SECONDS,
		);
		if (count > DAILY_LIMIT) {
			throw new HttpException(
				{
					code: "AI_DAILY_LIMIT",
					message:
						"You've reached today's AI limit. Please try again tomorrow.",
				},
				HttpStatus.TOO_MANY_REQUESTS,
			);
		}
		return true;
	}
}
