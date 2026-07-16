import { Injectable, Logger } from "@nestjs/common";
import { PlatformSettingsService } from "../../shared/settings/platform-settings.service";
import { FakeGatewayAdapter } from "./adapters/fake-gateway.adapter";
import { PaystackAdapter } from "./adapters/paystack.adapter";
import { StripeAdapter } from "./adapters/stripe.adapter";
import type {
	PaymentGatewayPort,
	PaymentProviderName,
} from "./payment-gateway.port";

/**
 * Resolves a `PaymentProvider → adapter` (§6.4, §14.1). A provider gets its real
 * adapter only when its credentials are present; otherwise the Fake takes over,
 * so dev/e2e run the full flow with no live keys and a half-configured provider
 * can never silently attempt real charges. Provider choice by currency:
 * NGN/GHS/ZAR → Paystack, everything else → Stripe (overridable per-checkout).
 */
@Injectable()
export class PaymentGatewayRegistry {
	private readonly logger = new Logger(PaymentGatewayRegistry.name);
	private readonly adapters: Record<PaymentProviderName, PaymentGatewayPort>;

	constructor(private readonly settings: PlatformSettingsService) {
		const paystackKey = process.env.PAYSTACK_SECRET_KEY;
		const stripeKey = process.env.STRIPE_SECRET_KEY;
		const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET;

		this.adapters = {
			paystack: paystackKey
				? new PaystackAdapter(paystackKey)
				: new FakeGatewayAdapter("paystack"),
			stripe:
				stripeKey && stripeWebhook
					? new StripeAdapter(stripeKey, stripeWebhook)
					: new FakeGatewayAdapter("stripe"),
		};

		for (const [name, adapter] of Object.entries(this.adapters)) {
			if (!adapter.isLive) {
				this.logger.warn(
					`Payment provider '${name}' has no credentials — using the Fake gateway.`,
				);
			}
		}
	}

	forProvider(provider: PaymentProviderName): PaymentGatewayPort {
		return this.adapters[provider];
	}

	/** Currency → provider (§14.1). Paystack for West-African currencies. */
	providerForCurrency(currency: string): PaymentProviderName {
		return ["NGN", "GHS", "ZAR", "KES"].includes(currency.toUpperCase())
			? "paystack"
			: "stripe";
	}

	/** The providers Admin currently offers at checkout (§14.1). */
	enabledProviders(): Promise<PaymentProviderName[]> {
		return this.settings.enabledPaymentProviders();
	}

	/**
	 * The provider a checkout should actually use: the learner's choice when it is
	 * one Admin offers, else the currency's natural provider, else whatever is
	 * enabled. Admin's switch always wins over the currency default, so turning a
	 * provider off genuinely takes it out of circulation.
	 */
	async resolveProvider(
		currency: string,
		requested?: PaymentProviderName,
	): Promise<PaymentProviderName> {
		const enabled = await this.enabledProviders();
		if (requested && enabled.includes(requested)) return requested;
		const preferred = this.providerForCurrency(currency);
		return enabled.includes(preferred) ? preferred : enabled[0];
	}
}
