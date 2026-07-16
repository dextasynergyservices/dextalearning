import { apiFetch } from "./api";

/**
 * Admin payment-settings client (§2, §14). Read the money-governing platform
 * settings + their bounds, and update one at a time.
 */

export type PaymentSettingKey =
	| "platform_fee_pct"
	| "instructor_revenue_share_pct"
	| "earn_back_max_duration_days"
	| "default_earn_back_percentage";

export interface SettingBound {
	key: PaymentSettingKey;
	value: number;
	min: number;
	max: number;
}

export type PaymentProviderName = "paystack" | "stripe";

export interface PaymentSettingsResponse {
	settings: SettingBound[];
	/** Providers currently offered at checkout (§14.1). */
	providers: PaymentProviderName[];
	/** Every provider the platform has an adapter for. */
	allProviders: PaymentProviderName[];
}

export const adminSettingsKeys = {
	payments: ["admin", "settings", "payments"] as const,
};

export const getPaymentSettings = () =>
	apiFetch<PaymentSettingsResponse>("/admin/settings/payments");

export const updatePaymentSetting = (key: PaymentSettingKey, value: number) =>
	apiFetch<{ settings: SettingBound[] }>("/admin/settings/payments", {
		method: "PATCH",
		body: JSON.stringify({ key, value }),
	});

/** Choose which payment methods learners are offered (§14.1). */
export const updatePaymentProviders = (providers: PaymentProviderName[]) =>
	apiFetch<{ providers: PaymentProviderName[] }>(
		"/admin/settings/payments/providers",
		{ method: "PATCH", body: JSON.stringify({ providers }) },
	);
