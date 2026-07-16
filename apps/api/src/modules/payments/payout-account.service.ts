import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { PayoutProvider } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { BankOption } from "./payment-gateway.port";
import { PaymentGatewayRegistry } from "./payment-gateway.registry";

/**
 * Instructor payout accounts (§14.3). An instructor may register SEVERAL
 * accounts (Paystack bank accounts verified via account resolution, and/or a
 * Stripe Connect account) and choose which is the DEFAULT — the one the payout
 * worker sends earnings to. Instructors can publish without any account;
 * earnings then accumulate as `pending` payouts until an account is verified
 * and set default (Admin can bulk-run them).
 */
export interface PayoutAccountView {
	id: string;
	provider: PayoutProvider;
	verified: boolean;
	isDefault: boolean;
	label: string | null;
	accountName: string | null;
	bankName: string | null;
	/** Last 4 of the account number — never the full number. */
	last4: string | null;
}

interface StripeConnectCapable {
	createConnectOnboardingLink(
		accountId: string | null,
		refreshUrl: string,
		returnUrl: string,
	): Promise<{ accountId: string; url: string }>;
}

@Injectable()
export class PayoutAccountService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly gateways: PaymentGatewayRegistry,
	) {}

	private toView(acct: {
		id: string;
		provider: PayoutProvider;
		verified: boolean;
		isDefault: boolean;
		label: string | null;
		accountJson: unknown;
	}): PayoutAccountView {
		const j = (acct.accountJson ?? {}) as Record<string, unknown>;
		const accountNumber =
			typeof j.accountNumber === "string" ? j.accountNumber : null;
		return {
			id: acct.id,
			provider: acct.provider,
			verified: acct.verified,
			isDefault: acct.isDefault,
			label: acct.label,
			accountName: (j.accountName as string) ?? null,
			bankName: (j.bankName as string) ?? null,
			last4: accountNumber ? accountNumber.slice(-4) : null,
		};
	}

	/** All of the instructor's payout accounts, default first. */
	async listAccounts(userId: string): Promise<PayoutAccountView[]> {
		const rows = await this.prisma.payoutAccount.findMany({
			where: { userId },
			orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
		});
		return rows.map((r) => this.toView(r));
	}

	listBanks(): Promise<BankOption[]> {
		return this.gateways.forProvider("paystack").listBanks();
	}

	/**
	 * Verify a Nigerian bank account via Paystack account resolution and add it.
	 * The first verified account an instructor adds becomes the default. A number
	 * that can't be resolved is rejected, so an unverified account is never stored
	 * as verified.
	 */
	async addPaystackAccount(
		userId: string,
		input: { bankCode: string; accountNumber: string },
	): Promise<PayoutAccountView> {
		const resolved = await this.gateways
			.forProvider("paystack")
			.resolveAccount(input.accountNumber, input.bankCode);
		if (!resolved) {
			throw new BadRequestException(
				"We couldn't verify that account — check the number and bank",
			);
		}
		const banks = await this.gateways.forProvider("paystack").listBanks();
		const bankName = banks.find((b) => b.code === input.bankCode)?.name ?? null;

		const existingCount = await this.prisma.payoutAccount.count({
			where: { userId },
		});
		const created = await this.prisma.payoutAccount.create({
			data: {
				userId,
				provider: "paystack",
				verified: true,
				isDefault: existingCount === 0,
				label: bankName
					? `${bankName} ••••${input.accountNumber.slice(-4)}`
					: `••••${input.accountNumber.slice(-4)}`,
				accountJson: {
					bankCode: input.bankCode,
					accountNumber: input.accountNumber,
					accountName: resolved.accountName,
					bankName,
				},
			},
		});
		await this.syncUserVerified(userId);
		return this.toView(created);
	}

	/** Make one account the default payout target; unsets the others atomically. */
	async setDefault(
		userId: string,
		accountId: string,
	): Promise<PayoutAccountView[]> {
		const acct = await this.prisma.payoutAccount.findFirst({
			where: { id: accountId, userId },
			select: { id: true, verified: true },
		});
		if (!acct) throw new NotFoundException("Payout account not found");
		if (!acct.verified) {
			throw new BadRequestException(
				"Only a verified account can be the default",
			);
		}
		await this.prisma.$transaction([
			this.prisma.payoutAccount.updateMany({
				where: { userId },
				data: { isDefault: false },
			}),
			this.prisma.payoutAccount.update({
				where: { id: accountId },
				data: { isDefault: true },
			}),
		]);
		return this.listAccounts(userId);
	}

	/** Remove an account; if it was the default, promote another verified one. */
	async deleteAccount(
		userId: string,
		accountId: string,
	): Promise<PayoutAccountView[]> {
		const acct = await this.prisma.payoutAccount.findFirst({
			where: { id: accountId, userId },
			select: { id: true, isDefault: true },
		});
		if (!acct) throw new NotFoundException("Payout account not found");
		await this.prisma.payoutAccount.delete({ where: { id: accountId } });
		if (acct.isDefault) {
			const next = await this.prisma.payoutAccount.findFirst({
				where: { userId, verified: true },
				orderBy: { createdAt: "asc" },
				select: { id: true },
			});
			if (next) {
				await this.prisma.payoutAccount.update({
					where: { id: next.id },
					data: { isDefault: true },
				});
			}
		}
		await this.syncUserVerified(userId);
		return this.listAccounts(userId);
	}

	/** The default verified account the payout worker should transfer to. */
	getDefaultAccount(userId: string) {
		return this.prisma.payoutAccount.findFirst({
			where: { userId, isDefault: true, verified: true },
		});
	}

	/**
	 * Begin Stripe Connect onboarding — returns a hosted link. The account row is
	 * created unverified and marked verified only after Stripe confirms (out of
	 * scope for the Fake path).
	 */
	async startStripeConnect(
		userId: string,
		refreshUrl: string,
		returnUrl: string,
	): Promise<{ url: string }> {
		const adapter = this.gateways.forProvider("stripe");
		if (
			!adapter.isLive ||
			typeof (adapter as unknown as StripeConnectCapable)
				.createConnectOnboardingLink !== "function"
		) {
			throw new BadRequestException(
				"Stripe payouts are not configured on this environment",
			);
		}
		const existing = await this.prisma.payoutAccount.findFirst({
			where: { userId, provider: "stripe" },
		});
		const prior =
			existing &&
			typeof (existing.accountJson as Record<string, unknown>)
				?.stripeAccountId === "string"
				? ((existing.accountJson as Record<string, unknown>)
						.stripeAccountId as string)
				: undefined;

		const { accountId, url } = await (
			adapter as unknown as StripeConnectCapable
		).createConnectOnboardingLink(prior ?? null, refreshUrl, returnUrl);

		if (existing) {
			await this.prisma.payoutAccount.update({
				where: { id: existing.id },
				data: { accountJson: { stripeAccountId: accountId } },
			});
		} else {
			const count = await this.prisma.payoutAccount.count({
				where: { userId },
			});
			await this.prisma.payoutAccount.create({
				data: {
					userId,
					provider: "stripe",
					verified: false,
					isDefault: count === 0,
					label: "Stripe Connect",
					accountJson: { stripeAccountId: accountId },
				},
			});
		}
		return { url };
	}

	/** Keep the denormalised `User.payoutVerified` flag in step with the table. */
	private async syncUserVerified(userId: string): Promise<void> {
		const verified = await this.prisma.payoutAccount.count({
			where: { userId, verified: true },
		});
		await this.prisma.user.update({
			where: { id: userId },
			data: { payoutVerified: verified > 0 },
		});
	}
}
