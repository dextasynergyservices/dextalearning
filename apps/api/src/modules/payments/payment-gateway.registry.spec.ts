import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PlatformSettingsService } from "../../shared/settings/platform-settings.service";
import type { PaymentProviderName } from "./payment-gateway.port";
import { PaymentGatewayRegistry } from "./payment-gateway.registry";

/** The registry only needs the enabled-providers read from settings. */
function makeRegistry(
	enabled: PaymentProviderName[] = ["paystack", "stripe"],
): PaymentGatewayRegistry {
	return new PaymentGatewayRegistry({
		enabledPaymentProviders: async () => enabled,
	} as unknown as PlatformSettingsService);
}

describe("PaymentGatewayRegistry", () => {
	const saved = {
		paystack: process.env.PAYSTACK_SECRET_KEY,
		stripe: process.env.STRIPE_SECRET_KEY,
		stripeHook: process.env.STRIPE_WEBHOOK_SECRET,
	};

	beforeEach(() => {
		process.env.PAYSTACK_SECRET_KEY = "";
		process.env.STRIPE_SECRET_KEY = "";
		process.env.STRIPE_WEBHOOK_SECRET = "";
	});
	afterEach(() => {
		process.env.PAYSTACK_SECRET_KEY = saved.paystack;
		process.env.STRIPE_SECRET_KEY = saved.stripe;
		process.env.STRIPE_WEBHOOK_SECRET = saved.stripeHook;
	});

	it("falls back to the Fake gateway when a provider has no credentials", () => {
		const registry = makeRegistry();
		expect(registry.forProvider("paystack").isLive).toBe(false);
		expect(registry.forProvider("stripe").isLive).toBe(false);
	});

	it("routes West-African currencies to Paystack, others to Stripe (§14.1)", () => {
		const registry = makeRegistry();
		expect(registry.providerForCurrency("NGN")).toBe("paystack");
		expect(registry.providerForCurrency("ghs")).toBe("paystack");
		expect(registry.providerForCurrency("USD")).toBe("stripe");
		expect(registry.providerForCurrency("EUR")).toBe("stripe");
	});

	it("selects the real adapter when credentials are present", () => {
		process.env.PAYSTACK_SECRET_KEY = "sk_test_x";
		const registry = makeRegistry();
		expect(registry.forProvider("paystack").isLive).toBe(true);
		expect(registry.forProvider("paystack").provider).toBe("paystack");
	});

	// ── Admin's enabled-providers switch (§14.1) ────────────────────────────
	describe("resolveProvider", () => {
		it("uses the currency's natural provider when Admin offers it", async () => {
			const registry = makeRegistry(["paystack", "stripe"]);
			await expect(registry.resolveProvider("NGN")).resolves.toBe("paystack");
			await expect(registry.resolveProvider("USD")).resolves.toBe("stripe");
		});

		it("honours the learner's choice when Admin offers it", async () => {
			const registry = makeRegistry(["paystack", "stripe"]);
			// NGN would default to Paystack — the learner asked for Stripe.
			await expect(registry.resolveProvider("NGN", "stripe")).resolves.toBe(
				"stripe",
			);
		});

		it("ignores a learner's choice that Admin has switched off", async () => {
			const registry = makeRegistry(["paystack"]);
			await expect(registry.resolveProvider("NGN", "stripe")).resolves.toBe(
				"paystack",
			);
		});

		it("falls back off the currency default when Admin has switched it off", async () => {
			const registry = makeRegistry(["paystack"]);
			// USD would default to Stripe, but only Paystack is enabled.
			await expect(registry.resolveProvider("USD")).resolves.toBe("paystack");
		});
	});
});
