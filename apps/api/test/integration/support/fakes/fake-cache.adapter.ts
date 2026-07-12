import type { CachePort } from "../../../../src/shared/cache/cache.port";

/** In-memory `CachePort` for integration tests (no Redis, no TTL expiry). */
export class FakeCacheAdapter implements CachePort {
	store = new Map<string, string>();
	counters = new Map<string, number>();

	async get<T>(key: string): Promise<T | null> {
		const raw = this.store.get(key);
		return raw ? (JSON.parse(raw) as T) : null;
	}

	async set(key: string, value: unknown): Promise<void> {
		this.store.set(key, JSON.stringify(value));
	}

	async del(key: string): Promise<void> {
		this.store.delete(key);
	}

	async incr(key: string): Promise<number> {
		const next = (this.counters.get(key) ?? 0) + 1;
		this.counters.set(key, next);
		return next;
	}

	reset(): void {
		this.store.clear();
		this.counters.clear();
	}
}
