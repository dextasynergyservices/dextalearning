import { Inject, Injectable } from "@nestjs/common";
import type { PaymentProviderName } from "../../modules/payments/payment-gateway.port";
import { PrismaService } from "../../prisma/prisma.service";
import { CACHE_PORT, type CachePort } from "../cache/cache.port";

/** Setting keys whose value is a number (i.e. everything but the provider list). */
type NumericSettingKey = {
	[K in keyof typeof PlatformSettingsService.DEFAULTS]: (typeof PlatformSettingsService.DEFAULTS)[K] extends number
		? K
		: never;
}[keyof typeof PlatformSettingsService.DEFAULTS];

/**
 * Admin-configurable platform settings (§4.11.3, §14.2). A tiny typed read
 * model over the `platform_settings` key/value table, shared by the pricing
 * guardrail (Content) and the settlement/earn-back math (Payments) so neither
 * hard-codes 90/10 or the 60-day ceiling. Reads are cached briefly via
 * CachePort (best-effort) since they sit on the payment hot path; writes bust
 * the cache. Defaults mirror the Phase-0 seed so a missing row is never fatal.
 */
@Injectable()
export class PlatformSettingsService {
	/** Keys the platform understands, with their seeded defaults. */
	static readonly DEFAULTS = {
		earn_back_max_duration_days: 60,
		instructor_revenue_share_pct: 90,
		default_earn_back_percentage: 100,
		platform_fee_pct: 5,
		/** Comma-separated payment providers offered at checkout (§14.1). */
		enabled_payment_providers: "paystack,stripe",
	} as const;

	/** Every provider the platform has an adapter for (§14.1). */
	static readonly ALL_PAYMENT_PROVIDERS = ["paystack", "stripe"] as const;

	/**
	 * Hard cap on the platform fee, enforced in code and unmovable by Admin — a
	 * fat-finger can never wipe out instructor pay (§2 Platform Fee).
	 */
	static readonly PLATFORM_FEE_CAP_PCT = 30;

	/**
	 * Hard ceiling on the earn-back window, enforced in code and unmovable by
	 * Admin — keeps every deadline safely inside the 90-day gateway refund
	 * window (§4.11.3). Admin sees a warning above WARN_DURATION_DAYS.
	 */
	static readonly MAX_DURATION_CEILING_DAYS = 85;
	static readonly WARN_DURATION_DAYS = 75;

	private static readonly CACHE_TTL_SECONDS = 300;

	constructor(
		private readonly prisma: PrismaService,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
	) {}

	private cacheKey(key: string): string {
		return `platsetting:v1:${key}`;
	}

	/** Raw string value for a key, or its seeded default as a string. */
	async getRaw(
		key: keyof typeof PlatformSettingsService.DEFAULTS,
	): Promise<string> {
		const cached = await this.cache.get<string>(this.cacheKey(key));
		if (cached !== null) return cached;
		const row = await this.prisma.platformSetting.findUnique({
			where: { key },
			select: { value: true },
		});
		const value = row?.value ?? String(PlatformSettingsService.DEFAULTS[key]);
		await this.cache.set(
			this.cacheKey(key),
			value,
			PlatformSettingsService.CACHE_TTL_SECONDS,
		);
		return value;
	}

	private async getInt(key: NumericSettingKey): Promise<number> {
		const parsed = Number.parseInt(await this.getRaw(key), 10);
		return Number.isFinite(parsed)
			? parsed
			: PlatformSettingsService.DEFAULTS[key];
	}

	/** Instructor share of settled revenue, 0–100 (default 90). */
	instructorRevenueSharePct(): Promise<number> {
		return this.getInt("instructor_revenue_share_pct");
	}

	/**
	 * Non-refundable platform fee percentage taken off the top of every paid
	 * sale (§2), clamped to [0, cap] so a bad value can't wipe out instructor pay.
	 */
	async platformFeePct(): Promise<number> {
		const configured = await this.getInt("platform_fee_pct");
		return Math.min(
			PlatformSettingsService.PLATFORM_FEE_CAP_PCT,
			Math.max(0, configured),
		);
	}

	/**
	 * Admin-configured earn-back window ceiling, clamped to the code hard-ceiling
	 * so a bad DB value can never push a deadline past the gateway refund window.
	 */
	async earnBackMaxDurationDays(): Promise<number> {
		const configured = await this.getInt("earn_back_max_duration_days");
		return Math.min(
			PlatformSettingsService.MAX_DURATION_CEILING_DAYS,
			Math.max(1, configured),
		);
	}

	/** Default earn-back percentage applied when eligibility is toggled on. */
	defaultEarnBackPercentage(): Promise<number> {
		return this.getInt("default_earn_back_percentage");
	}

	/**
	 * Payment providers Admin has switched on for checkout (§14.1). Unknown names
	 * are dropped, and an empty/garbage value falls back to every provider — a bad
	 * row must never take the whole platform's checkout offline.
	 */
	async enabledPaymentProviders(): Promise<PaymentProviderName[]> {
		const raw = await this.getRaw("enabled_payment_providers");
		const parsed = raw
			.split(",")
			.map((s) => s.trim().toLowerCase())
			.filter((s): s is PaymentProviderName =>
				(
					PlatformSettingsService.ALL_PAYMENT_PROVIDERS as readonly string[]
				).includes(s),
			);
		return parsed.length > 0
			? [...new Set(parsed)]
			: [...PlatformSettingsService.ALL_PAYMENT_PROVIDERS];
	}

	/** Admin write — updates the value and busts the cached copy. */
	async set(
		key: keyof typeof PlatformSettingsService.DEFAULTS,
		value: string,
		updatedBy?: string,
	): Promise<void> {
		await this.prisma.platformSetting.upsert({
			where: { key },
			update: { value, updatedBy, updatedAt: new Date() },
			create: { key, value, updatedBy },
		});
		await this.cache.del(this.cacheKey(key));
	}
}
