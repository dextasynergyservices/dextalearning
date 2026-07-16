import { BadRequestException, Injectable } from "@nestjs/common";
import { PlatformSettingsService } from "../../shared/settings/platform-settings.service";
import type { PaymentProviderName } from "./payment-gateway.port";

/**
 * Admin payment-settings surface (§2). Read + update the money-governing
 * platform settings behind bounds so a bad value can't break the economics —
 * the platform fee is capped in code, the earn-back window can't exceed the
 * gateway-safe ceiling, etc. Writes go through PlatformSettingsService (which
 * busts its own cache), so changes take effect on the next order.
 */
export interface SettingBound {
	key: PaymentSettingKey;
	value: number;
	min: number;
	max: number;
}

export type PaymentSettingKey =
	| "platform_fee_pct"
	| "instructor_revenue_share_pct"
	| "earn_back_max_duration_days"
	| "default_earn_back_percentage";

@Injectable()
export class AdminSettingsService {
	private readonly bounds: Record<
		PaymentSettingKey,
		{ min: number; max: number }
	> = {
		platform_fee_pct: {
			min: 0,
			max: PlatformSettingsService.PLATFORM_FEE_CAP_PCT,
		},
		instructor_revenue_share_pct: { min: 0, max: 100 },
		earn_back_max_duration_days: {
			min: 1,
			max: PlatformSettingsService.MAX_DURATION_CEILING_DAYS,
		},
		default_earn_back_percentage: { min: 1, max: 100 },
	};

	constructor(private readonly settings: PlatformSettingsService) {}

	/** Current values (already clamped by the accessors) + their bounds. */
	async getPaymentSettings(): Promise<SettingBound[]> {
		const [fee, share, maxDays, defaultPct] = await Promise.all([
			this.settings.platformFeePct(),
			this.settings.instructorRevenueSharePct(),
			this.settings.earnBackMaxDurationDays(),
			this.settings.defaultEarnBackPercentage(),
		]);
		const value: Record<PaymentSettingKey, number> = {
			platform_fee_pct: fee,
			instructor_revenue_share_pct: share,
			earn_back_max_duration_days: maxDays,
			default_earn_back_percentage: defaultPct,
		};
		return (Object.keys(this.bounds) as PaymentSettingKey[]).map((key) => ({
			key,
			value: value[key],
			...this.bounds[key],
		}));
	}

	/** Update one setting after validating it against its bounds. */
	async update(
		key: string,
		value: number,
		updatedBy?: string,
	): Promise<SettingBound[]> {
		if (!(key in this.bounds)) {
			throw new BadRequestException(`Unknown setting: ${key}`);
		}
		const bound = this.bounds[key as PaymentSettingKey];
		if (!Number.isInteger(value) || value < bound.min || value > bound.max) {
			throw new BadRequestException(
				`${key} must be an integer between ${bound.min} and ${bound.max}`,
			);
		}
		await this.settings.set(key as PaymentSettingKey, String(value), updatedBy);
		return this.getPaymentSettings();
	}

	/** The payment methods currently offered at checkout (§14.1). */
	getPaymentProviders(): Promise<PaymentProviderName[]> {
		return this.settings.enabledPaymentProviders();
	}

	/**
	 * Choose which payment methods learners are offered. At least one must stay
	 * on — an empty list would silently take every paid checkout offline, which
	 * is never what an Admin means to click.
	 */
	async updatePaymentProviders(
		providers: string[],
		updatedBy?: string,
	): Promise<PaymentProviderName[]> {
		const known = new Set<string>(
			PlatformSettingsService.ALL_PAYMENT_PROVIDERS,
		);
		const chosen = [
			...new Set(providers.map((p) => p.trim().toLowerCase())),
		].filter((p) => known.has(p));
		if (chosen.length !== providers.length) {
			throw new BadRequestException(
				`Payment methods must be among: ${[...known].join(", ")}`,
			);
		}
		if (chosen.length === 0) {
			throw new BadRequestException(
				"Keep at least one payment method switched on.",
			);
		}
		await this.settings.set(
			"enabled_payment_providers",
			chosen.join(","),
			updatedBy,
		);
		return this.getPaymentProviders();
	}
}
