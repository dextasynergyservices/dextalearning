import { describe, expect, it, vi } from "vitest";
import type { CachePort } from "../shared/cache/cache.port";
import { CacheThrottlerStorage } from "./throttler-storage";

function storageWith(incr: (key: string, ttl: number) => Promise<number>) {
	const cache = {
		get: vi.fn(),
		set: vi.fn(),
		del: vi.fn(),
		incr: vi.fn(incr),
	} as unknown as CachePort;
	return { storage: new CacheThrottlerStorage(cache), cache };
}

describe("CacheThrottlerStorage", () => {
	it("keys by throttler name + client key and converts ttl ms→s", async () => {
		const { storage, cache } = storageWith(async () => 1);
		await storage.increment("1.2.3.4", 60_000, 100, 0, "global");
		expect(cache.incr).toHaveBeenCalledWith("throttle:global:1.2.3.4", 60);
	});

	it("is not blocked while at or under the limit", async () => {
		const { storage } = storageWith(async () => 5);
		const rec = await storage.increment("k", 60_000, 5, 0, "auth");
		expect(rec.isBlocked).toBe(false);
		expect(rec.totalHits).toBe(5);
	});

	it("blocks once hits exceed the limit", async () => {
		const { storage } = storageWith(async () => 6);
		const rec = await storage.increment("k", 60_000, 5, 0, "auth");
		expect(rec.isBlocked).toBe(true);
	});

	it("fails OPEN when the cache is down (incr returns 0)", async () => {
		const { storage } = storageWith(async () => 0);
		const rec = await storage.increment("k", 60_000, 5, 0, "auth");
		expect(rec.isBlocked).toBe(false);
		expect(rec.totalHits).toBe(1);
	});

	it("never sends a sub-second ttl to the store", async () => {
		const { storage, cache } = storageWith(async () => 1);
		await storage.increment("k", 200, 5, 0, "auth");
		expect(cache.incr).toHaveBeenCalledWith("throttle:auth:k", 1);
	});
});
