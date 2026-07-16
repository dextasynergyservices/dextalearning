import { apiFetch } from "./api";

/**
 * Instructor earnings + payout-account client (§8.5, §14.3) for
 * `/instructor/earnings`. Read the summary/history; set up a Paystack bank
 * account or start Stripe Connect onboarding.
 */

export interface EarningsSummary {
	currency: string;
	lifetimeProcessed: number;
	pending: number;
	failed: number;
	processedCount: number;
	pendingCount: number;
}

export type PayoutStatus = "pending" | "processed" | "failed" | null;

export interface PayoutHistoryRow {
	id: string;
	amount: number;
	currency: string;
	status: PayoutStatus;
	entityTitle: string | null;
	triggeredAt: string;
	processedAt: string | null;
	failedReason: string | null;
}

export interface PayoutAccount {
	id: string;
	provider: "paystack" | "stripe";
	verified: boolean;
	isDefault: boolean;
	label: string | null;
	accountName: string | null;
	bankName: string | null;
	last4: string | null;
}

export interface BankOption {
	name: string;
	code: string;
}

/** What became of one sale, from the creator's side (§8.5). */
export type SaleOutcome =
	| "settled"
	| "at_stake"
	| "finished_on_time"
	| "finished_late"
	| "deadline_missed";

export interface SaleLedgerRow {
	orderId: string;
	entityType: string | null;
	entityTitle: string | null;
	learnerName: string;
	currency: string;
	gross: number;
	earnBackPercentage: number | null;
	outcome: SaleOutcome;
	guaranteed: number;
	/** Ceiling still riding on an open escrow — NOT money the creator has. */
	atStake: number;
	earnedFromEscrow: number;
	totalEarned: number;
	daysLate: number | null;
	deadline: string | null;
	soldAt: string;
}

export interface SaleLedgerView {
	currency: string;
	summary: {
		salesCount: number;
		grossMinor: number;
		earnedMinor: number;
		atStakeMinor: number;
		finishedOnTimeCount: number;
		grossMajor: number;
		earnedMajor: number;
		atStakeMajor: number;
	};
	rows: SaleLedgerRow[];
}

export const earningsKeys = {
	summary: ["earnings", "summary"] as const,
	ledger: ["earnings", "ledger"] as const,
	accounts: ["earnings", "payout-accounts"] as const,
	banks: ["earnings", "banks"] as const,
};

export const getEarnings = () =>
	apiFetch<{ summary: EarningsSummary; history: PayoutHistoryRow[] }>(
		"/payments/earnings",
	);

/** The creator's commercial ledger: every sale and what became of it. */
export const getEarningsLedger = () =>
	apiFetch<SaleLedgerView>("/payments/earnings/ledger");

export const getPayoutAccounts = () =>
	apiFetch<{ accounts: PayoutAccount[] }>("/payments/payout-accounts");

export const getBanks = () =>
	apiFetch<{ banks: BankOption[] }>("/payments/banks");

export const addPaystackAccount = (input: {
	bankCode: string;
	accountNumber: string;
}) =>
	apiFetch<PayoutAccount>("/payments/payout-accounts/paystack", {
		method: "POST",
		body: JSON.stringify(input),
	});

export const setDefaultAccount = (id: string) =>
	apiFetch<{ accounts: PayoutAccount[] }>(
		`/payments/payout-accounts/${id}/default`,
		{ method: "POST" },
	);

export const deletePayoutAccount = (id: string) =>
	apiFetch<{ accounts: PayoutAccount[] }>(`/payments/payout-accounts/${id}`, {
		method: "DELETE",
	});

export const startStripeConnect = () =>
	apiFetch<{ url: string }>("/payments/payout-accounts/stripe/connect", {
		method: "POST",
	});

/** Format a major-unit amount with its currency for display. */
export function formatMoney(amount: number, currency: string): string {
	try {
		return new Intl.NumberFormat(undefined, {
			style: "currency",
			currency,
			maximumFractionDigits: 2,
		}).format(amount);
	} catch {
		return `${currency} ${amount.toFixed(2)}`;
	}
}
