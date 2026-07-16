import { Logger } from "@nestjs/common";
import Stripe from "stripe";
import type {
	BankOption,
	GatewayVerifyResult,
	GatewayWebhookEvent,
	InitTransactionInput,
	InitTransactionResult,
	PaymentGatewayPort,
	RefundInput,
	RefundResult,
	ResolvedAccount,
	TransferInput,
	TransferResult,
} from "../payment-gateway.port";

/**
 * Stripe adapter (§14.1) — international cards. A Checkout Session hosts the
 * payment; the `checkout.session.completed` webhook (verified via the endpoint
 * secret + SDK) settles it. Instructor payout goes over Stripe Connect
 * (transfer to the instructor's connected account). Amounts are cents == our
 * minor-unit contract. Instantiated only when STRIPE_SECRET_KEY is set.
 */
export class StripeAdapter implements PaymentGatewayPort {
	readonly provider = "stripe" as const;
	readonly isLive = true;
	private readonly logger = new Logger(StripeAdapter.name);
	private readonly stripe: InstanceType<typeof Stripe>;

	constructor(
		secretKey: string,
		private readonly webhookSecret: string,
	) {
		this.stripe = new Stripe(secretKey);
	}

	async initTransaction(
		input: InitTransactionInput,
	): Promise<InitTransactionResult> {
		const session = await this.stripe.checkout.sessions.create({
			mode: "payment",
			client_reference_id: input.reference,
			customer_email: input.email,
			metadata: { reference: input.reference, ...(input.metadata ?? {}) },
			line_items: [
				{
					quantity: 1,
					price_data: {
						currency: input.currency.toLowerCase(),
						unit_amount: input.amountMinor,
						product_data: {
							name: input.metadata?.entityTitle ?? "Enrolment",
						},
					},
				},
			],
			success_url: `${input.callbackUrl}?reference=${input.reference}`,
			cancel_url: input.callbackUrl,
		});
		return {
			authorizationUrl: session.url ?? input.callbackUrl,
			providerRef: session.id,
		};
	}

	verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean {
		if (!signatureHeader) return false;
		try {
			this.stripe.webhooks.constructEvent(
				rawBody,
				signatureHeader,
				this.webhookSecret,
			);
			return true;
		} catch {
			return false;
		}
	}

	parseWebhook(rawBody: Buffer): GatewayWebhookEvent {
		try {
			// Minimal local shape — avoids depending on the SDK's namespace types,
			// which vary across `stripe` type versions. We only read these fields.
			const event = JSON.parse(rawBody.toString("utf8")) as {
				type?: string;
				data?: {
					object?: {
						client_reference_id?: string | null;
						amount_total?: number | null;
						currency?: string | null;
					};
				};
			};
			if (event.type !== "checkout.session.completed") {
				return {
					kind: "ignored",
					reference: null,
					amountMinor: null,
					currency: null,
				};
			}
			const session = event.data?.object;
			return {
				kind: "charge.success",
				reference: session?.client_reference_id ?? null,
				amountMinor: session?.amount_total ?? null,
				currency: session?.currency?.toUpperCase() ?? null,
			};
		} catch {
			return {
				kind: "ignored",
				reference: null,
				amountMinor: null,
				currency: null,
			};
		}
	}

	async createTransfer(input: TransferInput): Promise<TransferResult> {
		try {
			const destination = input.account.stripeAccountId;
			if (typeof destination !== "string" || !destination) {
				return {
					providerRef: input.idempotencyKey,
					status: "failed",
					failedReason: "No connected Stripe account",
				};
			}
			const transfer = await this.stripe.transfers.create(
				{
					amount: input.amountMinor,
					currency: input.currency.toLowerCase(),
					destination,
					description: input.reason,
				},
				{ idempotencyKey: input.idempotencyKey },
			);
			return { providerRef: transfer.id, status: "processed" };
		} catch (error) {
			const reason = (error as Error).message;
			this.logger.error(`Stripe transfer failed: ${reason}`);
			return {
				providerRef: input.idempotencyKey,
				status: "failed",
				failedReason: reason,
			};
		}
	}

	async verifyTransaction(reference: string): Promise<GatewayVerifyResult> {
		try {
			const session = await this.stripe.checkout.sessions.retrieve(reference);
			return {
				status:
					session.payment_status === "paid"
						? "success"
						: session.status === "expired"
							? "failed"
							: "pending",
				amountMinor: session.amount_total ?? null,
				currency: session.currency?.toUpperCase() ?? null,
			};
		} catch (error) {
			this.logger.error(
				`Stripe verify failed for ${reference}: ${(error as Error).message}`,
			);
			return { status: "pending", amountMinor: null, currency: null };
		}
	}

	async createRefund(input: RefundInput): Promise<RefundResult> {
		try {
			// `originalReference` is the Checkout Session id; resolve it to the
			// payment intent Stripe refunds against.
			const session = await this.stripe.checkout.sessions.retrieve(
				input.originalReference,
			);
			const paymentIntent =
				typeof session.payment_intent === "string"
					? session.payment_intent
					: session.payment_intent?.id;
			if (!paymentIntent) {
				return {
					providerRef: input.idempotencyKey,
					status: "failed",
					failedReason: "No payment intent on session",
				};
			}
			const refund = await this.stripe.refunds.create(
				{ payment_intent: paymentIntent, amount: input.amountMinor },
				{ idempotencyKey: input.idempotencyKey },
			);
			return { providerRef: refund.id, status: "processed" };
		} catch (error) {
			const reason = (error as Error).message;
			this.logger.error(`Stripe refund failed: ${reason}`);
			return {
				providerRef: input.idempotencyKey,
				status: "failed",
				failedReason: reason,
			};
		}
	}

	// Stripe onboards payout accounts via Connect (a hosted onboarding link),
	// not bank-code resolution — these Paystack-shaped hooks are inert here.
	async listBanks(): Promise<BankOption[]> {
		return [];
	}

	async resolveAccount(): Promise<ResolvedAccount | null> {
		return null;
	}

	/** Stripe Connect onboarding link for an instructor's Express account. */
	async createConnectOnboardingLink(
		accountId: string | null,
		refreshUrl: string,
		returnUrl: string,
	): Promise<{ accountId: string; url: string }> {
		const account =
			accountId ?? (await this.stripe.accounts.create({ type: "express" })).id;
		const link = await this.stripe.accountLinks.create({
			account,
			refresh_url: refreshUrl,
			return_url: returnUrl,
			type: "account_onboarding",
		});
		return { accountId: account, url: link.url };
	}
}
