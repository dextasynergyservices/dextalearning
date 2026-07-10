/**
 * Cache port (§6.4 ports & adapters). Contexts depend on this interface, never
 * on ioredis directly; the leaderboard uses it to memoise expensive rank
 * computations. A cache is best-effort — every method degrades to a miss/no-op
 * rather than throwing, so a Redis outage never breaks a request.
 */
export const CACHE_PORT = Symbol("CACHE_PORT");

export interface CachePort {
	/** Returns the cached value, or null on a miss (or any backend error). */
	get<T>(key: string): Promise<T | null>;
	/** Stores a JSON-serialisable value with a time-to-live in seconds. */
	set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
	/** Deletes a key (no-op if absent). */
	del(key: string): Promise<void>;
}
