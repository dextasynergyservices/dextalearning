import { createHmac } from "node:crypto";
import { Logger } from "@nestjs/common";
import axios, { type AxiosInstance } from "axios";
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
 * Paystack adapter (§14.1) — Nigerian + West African cards/transfer/USSD.
 * Amounts are already in kobo (our minor-unit contract == Paystack's), so no
 * scaling here. Webhook auth is HMAC-SHA512 of the raw body with the secret
 * key (Paystack's documented scheme). Instructor payout = transfer recipient +
 * transfer. Instantiated only when PAYSTACK_SECRET_KEY is set (else Fake).
 */
export class PaystackAdapter implements PaymentGatewayPort {
	readonly provider = "paystack" as const;
	readonly isLive = true;
	private readonly logger = new Logger(PaystackAdapter.name);
	private readonly http: AxiosInstance;

	constructor(private readonly secretKey: string) {
		this.http = axios.create({
			baseURL: "https://api.paystack.co",
			headers: { Authorization: `Bearer ${secretKey}` },
			timeout: 15_000,
		});
	}

	async initTransaction(
		input: InitTransactionInput,
	): Promise<InitTransactionResult> {
		const { data } = await this.http.post("/transaction/initialize", {
			email: input.email,
			amount: input.amountMinor,
			currency: input.currency,
			reference: input.reference,
			callback_url: input.callbackUrl,
			metadata: input.metadata ?? {},
		});
		return {
			authorizationUrl: data.data.authorization_url,
			providerRef: data.data.reference ?? input.reference,
		};
	}

	verifyWebhook(rawBody: Buffer, signatureHeader: string | undefined): boolean {
		if (!signatureHeader) return false;
		const expected = createHmac("sha512", this.secretKey)
			.update(rawBody)
			.digest("hex");
		return expected === signatureHeader;
	}

	parseWebhook(rawBody: Buffer): GatewayWebhookEvent {
		try {
			const body = JSON.parse(rawBody.toString("utf8")) as {
				event?: string;
				data?: { reference?: string; amount?: number; currency?: string };
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
				reference: body.data?.reference ?? null,
				amountMinor: body.data?.amount ?? null,
				currency: body.data?.currency ?? null,
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

	async verifyTransaction(reference: string): Promise<GatewayVerifyResult> {
		try {
			const { data } = await this.http.get(
				`/transaction/verify/${encodeURIComponent(reference)}`,
			);
			const status = data.data?.status as string | undefined;
			return {
				status:
					status === "success"
						? "success"
						: status === "failed" || status === "abandoned"
							? "failed"
							: "pending",
				amountMinor: data.data?.amount ?? null,
				currency: data.data?.currency ?? null,
			};
		} catch (error) {
			this.logger.error(
				`Paystack verify failed for ${reference}: ${(error as Error).message}`,
			);
			return { status: "pending", amountMinor: null, currency: null };
		}
	}

	async createTransfer(input: TransferInput): Promise<TransferResult> {
		try {
			const recipient = await this.http.post("/transferrecipient", {
				type: "nuban",
				name: input.account.accountName ?? "Instructor",
				account_number: input.account.accountNumber,
				bank_code: input.account.bankCode,
				currency: input.currency,
			});
			const transfer = await this.http.post("/transfer", {
				source: "balance",
				amount: input.amountMinor,
				recipient: recipient.data.data.recipient_code,
				reason: input.reason,
				reference: input.idempotencyKey,
			});
			return {
				providerRef: transfer.data.data.transfer_code ?? input.idempotencyKey,
				status: "processed",
			};
		} catch (error) {
			const reason =
				axios.isAxiosError(error) && error.response?.data?.message
					? String(error.response.data.message)
					: (error as Error).message;
			this.logger.error(`Paystack transfer failed: ${reason}`);
			return {
				providerRef: input.idempotencyKey,
				status: "failed",
				failedReason: reason,
			};
		}
	}

	async createRefund(input: RefundInput): Promise<RefundResult> {
		try {
			const { data } = await this.http.post("/refund", {
				transaction: input.originalReference,
				amount: input.amountMinor,
				currency: input.currency,
				merchant_note: input.reason,
			});
			return {
				providerRef: String(data.data?.id ?? input.idempotencyKey),
				status: "processed",
			};
		} catch (error) {
			const reason =
				axios.isAxiosError(error) && error.response?.data?.message
					? String(error.response.data.message)
					: (error as Error).message;
			this.logger.error(`Paystack refund failed: ${reason}`);
			return {
				providerRef: input.idempotencyKey,
				status: "failed",
				failedReason: reason,
			};
		}
	}

	async listBanks(): Promise<BankOption[]> {
		try {
			const { data } = await this.http.get("/bank", {
				params: { currency: "NGN" },
			});
			return (data.data as { name: string; code: string }[]).map((b) => ({
				name: b.name,
				code: b.code,
			}));
		} catch (error) {
			this.logger.error(
				`Paystack bank list failed: ${(error as Error).message}`,
			);
			return [];
		}
	}

	async resolveAccount(
		accountNumber: string,
		bankCode: string,
	): Promise<ResolvedAccount | null> {
		try {
			const { data } = await this.http.get("/bank/resolve", {
				params: { account_number: accountNumber, bank_code: bankCode },
			});
			const accountName = data.data?.account_name;
			return accountName ? { accountName } : null;
		} catch {
			return null; // unresolvable account → caller surfaces a friendly error
		}
	}
}
