import { beforeEach, describe, expect, it } from "vitest";
import { RedisCacheAdapter } from "./redis-cache.adapter";

// No REDIS_URL in unit tests → the adapter uses its in-memory fallback.
describe("RedisCacheAdapter (memory fallback)", () => {
	let cache: RedisCacheAdapter;

	beforeEach(() => {
		delete process.env.REDIS_URL;
		cache = new RedisCacheAdapter();
	});

	it("round-trips a value", async () => {
		await cache.set("k", { a: 1 }, 60);
		expect(await cache.get<{ a: number }>("k")).toEqual({ a: 1 });
	});

	it("returns null on a miss", async () => {
		expect(await cache.get("nope")).toBeNull();
	});

	it("increments a counter and keeps the window", async () => {
		expect(await cache.incr("q", 60)).toBe(1);
		expect(await cache.incr("q", 60)).toBe(2);
		expect(await cache.incr("q", 60)).toBe(3);
	});

	it("del removes a key", async () => {
		await cache.set("k", "v", 60);
		await cache.del("k");
		expect(await cache.get("k")).toBeNull();
	});
});
