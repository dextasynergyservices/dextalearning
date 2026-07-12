import type { CachePort } from "../shared/cache/cache.port";

/**
 * Single-runner lock for in-process cron sweeps, so a horizontally-scaled
 * deployment fires each scheduled sweep on exactly ONE instance. Uses an atomic
 * `INCR` on a time-bucketed key: the first instance to increment wins (result
 * 1); later instances see > 1 and skip. Fail-open — if the cache errors (`incr`
 * returns 0) every instance runs, which is safe because the sweeps are
 * idempotent (unique-key dedup / delete-then-insert). Costs ONE Redis command
 * per tick per instance, vs ~17k/day for a blocking BullMQ worker.
 */
export async function acquireCronLock(
	cache: CachePort,
	key: string,
	ttlSeconds: number,
): Promise<boolean> {
	const count = await cache.incr(key, ttlSeconds);
	return count <= 1;
}
