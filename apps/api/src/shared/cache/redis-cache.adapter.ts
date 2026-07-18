import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import type { CachePort } from "./cache.port";

/**
 * `CachePort` backed by Redis (ioredis) when `REDIS_URL` is set, and by a small
 * in-process Map otherwise — so local dev and tests work with no Redis running.
 * Every operation is wrapped so a backend error becomes a cache miss/no-op,
 * never a thrown error: the cache is an optimisation, not a dependency.
 */
@Injectable()
export class RedisCacheAdapter implements CachePort, OnModuleDestroy {
	private readonly logger = new Logger(RedisCacheAdapter.name);
	private readonly redis: Redis | null;
	private readonly memory = new Map<
		string,
		{ value: string; expiresAt: number }
	>();

	constructor() {
		const url = process.env.REDIS_URL;
		this.redis = url
			? new Redis(url, {
					// Connect on first cache op, not at boot: on the free serverless
					// tier the instance is idle (scaled toward zero) much of the time,
					// so we don't hold/keep-alive a Redis socket until something
					// actually reads or writes the cache (infra budget).
					lazyConnect: true,
					maxRetriesPerRequest: 2,
					// Don't spam reconnects forever if Redis is unreachable in dev.
					retryStrategy: (times) =>
						times > 5 ? null : Math.min(times * 200, 1000),
				})
			: null;
		this.redis?.on("error", (err) =>
			this.logger.warn(`redis cache unavailable: ${err.message}`),
		);
	}

	async get<T>(key: string): Promise<T | null> {
		try {
			const raw = this.redis ? await this.redis.get(key) : this.memoryGet(key);
			return raw ? (JSON.parse(raw) as T) : null;
		} catch {
			return null;
		}
	}

	async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
		const raw = JSON.stringify(value);
		try {
			if (this.redis) {
				await this.redis.set(key, raw, "EX", ttlSeconds);
			} else {
				this.memory.set(key, {
					value: raw,
					expiresAt: Date.now() + ttlSeconds * 1000,
				});
			}
		} catch {
			// best-effort — a failed write just means the next read recomputes.
		}
	}

	async del(key: string): Promise<void> {
		try {
			if (this.redis) await this.redis.del(key);
			else this.memory.delete(key);
		} catch {
			// no-op
		}
	}

	async incr(key: string, ttlSeconds: number): Promise<number> {
		try {
			if (this.redis) {
				const n = await this.redis.incr(key);
				if (n === 1) await this.redis.expire(key, ttlSeconds);
				return n;
			}
			const current = Number(this.memoryGet(key) ?? "0") + 1;
			this.memory.set(key, {
				value: String(current),
				// Keep the original window: only (re)set expiry when the key is new.
				expiresAt:
					current === 1
						? Date.now() + ttlSeconds * 1000
						: (this.memory.get(key)?.expiresAt ??
							Date.now() + ttlSeconds * 1000),
			});
			return current;
		} catch {
			// Fail-open: a broken counter must never lock a user out.
			return 0;
		}
	}

	private memoryGet(key: string): string | null {
		const hit = this.memory.get(key);
		if (!hit) return null;
		if (hit.expiresAt < Date.now()) {
			this.memory.delete(key);
			return null;
		}
		return hit.value;
	}

	async onModuleDestroy(): Promise<void> {
		await this.redis?.quit().catch(() => {});
	}
}
