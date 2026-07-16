/**
 * Payment gateway port (§6.4 ports & adapters, §14.1 dual-provider). The
 * Payments context depends on THIS interface, never on the Paystack/Stripe SDKs
 * directly — so the settlement/earn-back logic is testable with a Fake and a
 * new provider is a new adapter, nothing else. One adapter instance == one
 * provider; a registry resolves `PaymentProvider → adapter` (real when its keys
 * are configured, Fake otherwise) so dev/e2e never needs live credentials.
 *
 * MONEY IS INTEGER MINOR UNITS (kobo/cents) everywhere in this port, matching
 * the calculators; adapters do the ×100 / provider-shape conversion internally.
 */

export type PaymentProviderName = "paystack" | "stripe";

export interface InitTransactionInput {
	/** Our order id — echoed back on the webhook so we can reconcile. */
	reference: string;
	amountMinor: number;
	currency: string;
	email: string;
	/** Where the gateway returns the learner after paying. */
	callbackUrl: string;
	/** Opaque snapshot echoed back by the provider (entity type/id, etc.). */
	metadata?: Record<string, string>;
}

export interface InitTransactionResult {
	/** Hosted checkout URL the learner is redirected to. */
	authorizationUrl: string;
	/** Provider-side reference (may differ from ours; stored for support). */
	providerRef: string;
}

/** Normalised webhook event — the only shape the service reasons about. */
export interface GatewayWebhookEvent {
	/** Currently we only act on a successful charge. */
	kind: "charge.success" | "ignored";
	/** OUR order reference (from metadata/reference), when resolvable. */
	reference: string | null;
	amountMinor: number | null;
	currency: string | null;
}

/**
 * Result of directly verifying a transaction with the provider (§14) — the
 * verify-on-callback path, so payment confirms even when the async webhook
 * can't reach us (e.g. local dev, or a webhook delay).
 */
export interface GatewayVerifyResult {
	status: "success" | "failed" | "pending";
	amountMinor: number | null;
	currency: string | null;
}

export interface TransferInput {
	amountMinor: number;
	currency: string;
	/** Verified payout account snapshot ({ bankCode, accountNumber } etc.). */
	account: Record<string, unknown>;
	/** Human-readable reason shown on the recipient statement. */
	reason: string;
	/** Idempotency key so a retried job never double-pays. */
	idempotencyKey: string;
}

export interface TransferResult {
	providerRef: string;
	/** `processed` when the gateway accepted it; `failed` with a reason. */
	status: "processed" | "failed";
	failedReason?: string;
}

export interface RefundInput {
	amountMinor: number;
	currency: string;
	/** The original charge reference (Order.providerRef) to refund against. */
	originalReference: string;
	reason: string;
	idempotencyKey: string;
}

export interface RefundResult {
	providerRef: string;
	status: "processed" | "failed";
	failedReason?: string;
}

export interface BankOption {
	name: string;
	code: string;
}

export interface ResolvedAccount {
	accountName: string;
}

export interface PaymentGatewayPort {
	readonly provider: PaymentProviderName;
	/** True when real credentials are present (Fake reports false). */
	readonly isLive: boolean;

	initTransaction(input: InitTransactionInput): Promise<InitTransactionResult>;

	/** Verify the raw webhook body against the provider signature header. */
	verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean;

	/** Parse an already-verified webhook body into the normalised event. */
	parseWebhook(rawBody: Buffer): GatewayWebhookEvent;

	/**
	 * Directly ask the provider whether a transaction succeeded (verify-on-
	 * callback). `reference` is the provider-side identifier (our order id for
	 * Paystack; the Checkout Session id for Stripe).
	 */
	verifyTransaction(reference: string): Promise<GatewayVerifyResult>;

	/** Pay an instructor (Paystack Transfer / Stripe Payout). */
	createTransfer(input: TransferInput): Promise<TransferResult>;

	/**
	 * Refund an Earn-Back amount to the learner's ORIGINAL payment method
	 * (§4.11 "No Wallet"). Partial amounts are allowed (tardiness deductions).
	 */
	createRefund(input: RefundInput): Promise<RefundResult>;

	/** Banks for the payout-account picker (Paystack); [] where unsupported. */
	listBanks(): Promise<BankOption[]>;

	/**
	 * Verify a bank account and return the registered name (Paystack account
	 * resolution, §14.3), or null when the account can't be resolved. Providers
	 * without account resolution (Stripe → Connect onboarding) return null.
	 */
	resolveAccount(
		accountNumber: string,
		bankCode: string,
	): Promise<ResolvedAccount | null>;
}
