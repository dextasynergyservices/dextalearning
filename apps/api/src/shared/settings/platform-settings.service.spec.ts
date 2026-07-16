import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CachePort } from "../cache/cache.port";
import { PlatformSettingsService } from "./platform-settings.service";

function memoryCache(): CachePort {
	const store = new Map<string, unknown>();
	return {
		get: async <T>(k: string) => (store.has(k) ? (store.get(k) as T) : null),
		set: async (k, v) => {
			store.set(k, v);
		},
		del: async (k) => {
			store.delete(k);
		},
		incr: async () => 0,
	};
}

function serviceWith(rows: Record<string, string>) {
	const prisma = {
		platformSetting: {
			findUnique: vi.fn(async ({ where }: { where: { key: string } }) =>
				where.key in rows ? { value: rows[where.key] } : null,
			),
		},
	} as unknown as PrismaService;
	return new PlatformSettingsService(prisma, memoryCache());
}

describe("PlatformSettingsService", () => {
	it("returns seeded values from the DB", async () => {
		const svc = serviceWith({ instructor_revenue_share_pct: "90" });
		expect(await svc.instructorRevenueSharePct()).toBe(90);
	});

	it("falls back to defaults when a row is missing", async () => {
		const svc = serviceWith({});
		expect(await svc.instructorRevenueSharePct()).toBe(90);
		expect(await svc.defaultEarnBackPercentage()).toBe(100);
		expect(await svc.earnBackMaxDurationDays()).toBe(60);
	});

	it("clamps the earn-back window to the 85-day code ceiling", async () => {
		const svc = serviceWith({ earn_back_max_duration_days: "120" });
		expect(await svc.earnBackMaxDurationDays()).toBe(85);
	});

	it("never returns a window below 1 day", async () => {
		const svc = serviceWith({ earn_back_max_duration_days: "0" });
		expect(await svc.earnBackMaxDurationDays()).toBe(1);
	});

	it("falls back to the default on a non-numeric value", async () => {
		const svc = serviceWith({ instructor_revenue_share_pct: "junk" });
		expect(await svc.instructorRevenueSharePct()).toBe(90);
	});
});
