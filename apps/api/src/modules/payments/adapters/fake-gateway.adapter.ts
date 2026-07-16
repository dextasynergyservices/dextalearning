import { Logger } from "@nestjs/common";
import type {
	BankOption,
	GatewayVerifyResult,
	GatewayWebhookEvent,
	InitTransactionInput,
	InitTransactionResult,
	PaymentGatewayPort,
	PaymentProviderName,
	RefundInput,
	RefundResult,
	ResolvedAccount,
	TransferInput,
	TransferResult,
} from "../payment-gateway.port";

/**
 * Fake gateway (§6.4) — the adapter used in dev/e2e when a provider's real
 * credentials are absent, so the whole checkout → webhook → settlement → payout
 * flow runs end-to-end without live money. `initTransaction` returns a URL that
 * lands the learner back on the callback already "paid"; a webhook is simulated
 * by POSTing the deterministic body below with the shared fake signature.
 * Transfers always succeed. NEVER selected when live keys are configured.
 */
export class FakeGatewayAdapter implements PaymentGatewayPort {
	readonly isLive = false;
	private readonly logger = new Logger(FakeGatewayAdapter.name);

	constructor(readonly provider: PaymentProviderName) {}

	private get secret(): string {
		return process.env.FAKE_GATEWAY_SECRET ?? "fake-gateway-secret";
	}

	async initTransaction(
		input: InitTransactionInput,
	): Promise<InitTransactionResult> {
		const url = new URL(input.callbackUrl);
		url.searchParams.set("reference", input.reference);
		url.searchParams.set("simulated", "1");
		this.logger.debug(
			`[fake:${this.provider}] init ${input.reference} ${input.amountMinor} ${input.currency}`,
		);
		return {
			authorizationUrl: url.toString(),
			providerRef: `fake_${input.reference}`,
		};
	}

	verifyWebhook(
		_rawBody: Buffer,
		signatureHeader: string | undefined,
	): boolean {
		return signatureHeader === this.secret;
	}

	parseWebhook(rawBody: Buffer): GatewayWebhookEvent {
		try {
			const body = JSON.parse(rawBody.toString("utf8")) as {
				event?: string;
				reference?: string;
				amountMinor?: number;
				currency?: string;
			};
			if (body.event !== "charge.success") {
				return {
					kind: "ignored",
					reference: null,
					amountMinor: null,
					currency: null,
				};
			}
			return {
				kind: "charge.success",
				reference: body.reference ?? null,
				amountMinor: body.amountMinor ?? null,
				currency: body.currency ?? null,
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
		this.logger.debug(
			`[fake:${this.provider}] transfer ${input.amountMinor} ${input.currency} → ${JSON.stringify(input.account)}`,
		);
		return {
			providerRef: `fake_tr_${input.idempotencyKey}`,
			status: "processed",
		};
	}

	async verifyTransaction(_reference: string): Promise<GatewayVerifyResult> {
		// Dev/e2e: the Fake "gateway" always confirms so verify-on-callback settles
		// the order without a real provider or a reachable webhook.
		return { status: "success", amountMinor: null, currency: null };
	}

	async createRefund(input: RefundInput): Promise<RefundResult> {
		this.logger.debug(
			`[fake:${this.provider}] refund ${input.amountMinor} ${input.currency} → ${input.originalReference}`,
		);
		return {
			providerRef: `fake_rf_${input.idempotencyKey}`,
			status: "processed",
		};
	}

	async listBanks(): Promise<BankOption[]> {
		return [
			{ name: "Test Bank", code: "001" },
			{ name: "Demo MFB", code: "002" },
		];
	}

	async resolveAccount(
		accountNumber: string,
		_bankCode: string,
	): Promise<ResolvedAccount | null> {
		// Any 10-digit number "resolves" in dev so the setup flow is exercisable.
		if (!/^\d{10}$/.test(accountNumber)) return null;
		return { accountName: "Test Account Holder" };
	}
}
