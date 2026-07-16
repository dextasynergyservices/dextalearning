import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AdminSettingsService } from "../../src/modules/payments/admin-settings.service";
import type { CachePort } from "../../src/shared/cache/cache.port";
import { PlatformSettingsService } from "../../src/shared/settings/platform-settings.service";
import { getTestPrisma } from "./support/db";

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

describe("AdminSettingsService (integration)", () => {
	const prisma = getTestPrisma();
	const settings = new PlatformSettingsService(prisma, memoryCache());
	const service = new AdminSettingsService(settings);

	it("returns the four payment settings with their bounds", async () => {
		const rows = await service.getPaymentSettings();
		const fee = rows.find((r) => r.key === "platform_fee_pct");
		expect(fee).toMatchObject({ value: 5, min: 0, max: 30 });
		expect(rows.map((r) => r.key)).toEqual(
			expect.arrayContaining([
				"platform_fee_pct",
				"instructor_revenue_share_pct",
				"earn_back_max_duration_days",
				"default_earn_back_percentage",
			]),
		);
	});

	it("updates a setting within bounds and reflects it", async () => {
		await service.update("platform_fee_pct", 8);
		expect(await settings.platformFeePct()).toBe(8);
		// reset so other specs see the default
		await service.update("platform_fee_pct", 5);
	});

	it("rejects a fee above the 30% code cap", async () => {
		await expect(service.update("platform_fee_pct", 35)).rejects.toThrow(
			BadRequestException,
		);
	});

	it("rejects an unknown setting key", async () => {
		await expect(service.update("bogus_key", 1)).rejects.toThrow(
			BadRequestException,
		);
	});

	it("rejects an earn-back window above the 85-day ceiling", async () => {
		await expect(
			service.update("earn_back_max_duration_days", 120),
		).rejects.toThrow(BadRequestException);
	});

	// ── Payment methods offered at checkout (§14.1) ─────────────────────────
	describe("payment providers", () => {
		it("offers every provider by default", async () => {
			await expect(service.getPaymentProviders()).resolves.toEqual([
				"paystack",
				"stripe",
			]);
		});

		it("switches a provider off and reads it back", async () => {
			await expect(
				service.updatePaymentProviders(["paystack"]),
			).resolves.toEqual(["paystack"]);
			await expect(service.getPaymentProviders()).resolves.toEqual([
				"paystack",
			]);
			// Restore so later tests see the default.
			await service.updatePaymentProviders(["paystack", "stripe"]);
		});

		it("refuses to switch every provider off", async () => {
			await expect(service.updatePaymentProviders([])).rejects.toThrow(
				BadRequestException,
			);
		});

		it("rejects an unknown provider", async () => {
			await expect(
				service.updatePaymentProviders(["paystack", "bitcoin"]),
			).rejects.toThrow(BadRequestException);
		});
	});
});
