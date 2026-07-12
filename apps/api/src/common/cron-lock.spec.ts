import { describe, expect, it, vi } from "vitest";
import type { CachePort } from "../shared/cache/cache.port";
import { acquireCronLock } from "./cron-lock";

function cacheWith(incr: () => Promise<number>): CachePort {
	return {
		get: vi.fn(),
		set: vi.fn(),
		del: vi.fn(),
		incr,
	} as unknown as CachePort;
}

describe("acquireCronLock", () => {
	it("grants the lock to the first incrementer (result 1)", async () => {
		expect(
			await acquireCronLock(
				cacheWith(async () => 1),
				"k",
				60,
			),
		).toBe(true);
	});

	it("denies later instances (result > 1)", async () => {
		expect(
			await acquireCronLock(
				cacheWith(async () => 2),
				"k",
				60,
			),
		).toBe(false);
		expect(
			await acquireCronLock(
				cacheWith(async () => 9),
				"k",
				60,
			),
		).toBe(false);
	});

	it("fails open when the cache errors (incr returns 0)", async () => {
		expect(
			await acquireCronLock(
				cacheWith(async () => 0),
				"k",
				60,
			),
		).toBe(true);
	});
});
