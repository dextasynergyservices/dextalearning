import { apiFetch } from "./api";

/**
 * Admin payout oversight + bulk payout (§14.3). Admin-only endpoints to see
 * outstanding pending payouts grouped by instructor, trigger a bulk run, view
 * recent activity, and retry a failed payout.
 */

export interface PendingPayoutGroup {
	instructorId: string;
	instructorName: string;
	pendingCount: number;
	pendingTotal: number;
	currency: string;
	payable: boolean;
}

export interface AdminPayoutRow {
	id: string;
	instructorId: string | null;
	instructorName: string;
	amount: number;
	currency: string;
	status: "pending" | "processed" | "failed" | null;
	entityTitle: string | null;
	triggeredAt: string;
	processedAt: string | null;
	failedReason: string | null;
}

/**
 * A learner Earn-Back refund — the other leg of the money flow (§4.11.5).
 * Lives beside payouts because it answers the same Admin question, and because
 * an on-time full Earn-Back produces a refund and NO instructor payout at all.
 */
export interface AdminRefundRow {
	id: string;
	learnerId: string | null;
	learnerName: string;
	amount: number;
	currency: string;
	status: "pending" | "processed" | "failed" | "no_payout" | null;
	entityTitle: string | null;
	daysLate: number;
	calculatedAt: string;
	processedAt: string | null;
	failedReason: string | null;
}

export const adminPayoutKeys = {
	pending: ["admin", "payouts", "pending"] as const,
	recent: ["admin", "payouts", "recent"] as const,
	refunds: ["admin", "payouts", "refunds"] as const,
};

export const getPendingPayouts = () =>
	apiFetch<{
		groups: PendingPayoutGroup[];
		totalPending: number;
		payableTotal: number;
	}>("/admin/payouts/pending");

export const getRecentPayouts = () =>
	apiFetch<{ payouts: AdminPayoutRow[] }>("/admin/payouts");

export const getRecentRefunds = () =>
	apiFetch<{ refunds: AdminRefundRow[] }>("/admin/payouts/refunds");

export const runAllPayouts = () =>
	apiFetch<{ queued: number; skipped: number }>("/admin/payouts/run", {
		method: "POST",
	});

export const retryPayout = (id: string) =>
	apiFetch<{ queued: boolean }>(`/admin/payouts/${id}/retry`, {
		method: "POST",
	});

/** Re-send a failed Earn-Back refund — the learner's leg of the same duty. */
export const retryRefund = (id: string) =>
	apiFetch<{ queued: boolean }>(`/admin/payouts/refunds/${id}/retry`, {
		method: "POST",
	});
