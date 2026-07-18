import { Inject, Injectable } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import { CACHE_PORT, type CachePort } from "../shared/cache/cache.port";

/**
 * Throttler storage backed by the shared `CachePort` (§5.9 Layer 1). The
 * default in-memory storage counts PER INSTANCE — behind Railway's replica set
 * that silently multiplies every limit by the instance count. Routing the
 * counter through Redis (via CachePort.incr, which is one atomic INCR+EXPIRE)
 * makes the limit truly global.
 *
 * CachePort is fail-open by contract: if Redis is down, `incr` returns 0, which
 * here means "never blocked" — a rate limiter must not take the API down with
 * the cache it depends on. We do NOT implement block-duration (unused by our
 * fixed-window rules); `timeToBlockExpire` stays 0.
 */
@Injectable()
export class CacheThrottlerStorage implements ThrottlerStorage {
	constructor(@Inject(CACHE_PORT) private readonly cache: CachePort) {}

	async increment(
		key: string,
		ttl: number,
		limit: number,
		_blockDuration: number,
		throttlerName: string,
	): Promise<ThrottlerStorageRecord> {
		const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));
		const storeKey = `throttle:${throttlerName}:${key}`;
		const totalHits = await this.cache.incr(storeKey, ttlSeconds);
		// incr returned 0 ⇒ Redis unreachable: fail open (treat as first hit,
		// never blocked) so a cache outage can't lock everyone out.
		const hits = totalHits > 0 ? totalHits : 1;
		return {
			totalHits: hits,
			timeToExpire: ttlSeconds,
			isBlocked: hits > limit,
			timeToBlockExpire: 0,
		};
	}
}
