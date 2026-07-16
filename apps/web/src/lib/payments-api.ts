import { apiFetch } from "./api";
import type { EnrollableType } from "./content-api";

/**
 * Payments client (§14). Paid enrolment goes through a hosted gateway checkout:
 * `startCheckout` returns the authorization URL to redirect to; after the
 * gateway sends the learner back to `/checkout/callback`, the page polls
 * `getOrderStatus` until the webhook has settled the order.
 */

export interface CheckoutSession {
	authorizationUrl: string;
	orderId: string;
}

export type OrderStatus = "pending" | "paid" | "failed" | "earn_back_issued";

export interface OrderView {
	status: OrderStatus | null;
	entityType: EnrollableType | null;
	entityId: string | null;
	entityTitle: string | null;
}

export type PaymentProviderName = "paystack" | "stripe";

export interface PaymentMethods {
	providers: PaymentProviderName[];
	/**
	 * The provider the server would pick for `currency` — the picker preselects
	 * it rather than re-implementing currency routing client-side. Null when no
	 * currency was given.
	 */
	recommended: PaymentProviderName | null;
}

/** The payment methods Admin currently offers at checkout (§14.1). */
export const getPaymentMethods = (currency?: string) =>
	apiFetch<PaymentMethods>(
		currency
			? `/payments/methods?currency=${encodeURIComponent(currency)}`
			: "/payments/methods",
	);

/**
 * Begin a hosted checkout for a paid course/path/cohort. `provider` is a
 * preference only — the server ignores it unless Admin currently offers it.
 */
export const startCheckout = (
	type: EnrollableType,
	id: string,
	provider?: PaymentProviderName,
) =>
	apiFetch<CheckoutSession>(`/payments/checkout/${type}/${id}`, {
		method: "POST",
		body: JSON.stringify(provider ? { provider } : {}),
	});

/** Poll an order's settlement status from the checkout callback page. */
export const getOrderStatus = (orderId: string) =>
	apiFetch<{ order: OrderView | null }>(`/payments/order/${orderId}/status`);

/** Verify + settle a payment directly with the gateway (callback page). */
export const verifyPayment = (reference: string) =>
	apiFetch<{
		status: OrderStatus;
		entityType: EnrollableType | null;
		entityId: string | null;
		entityTitle: string | null;
	}>(`/payments/verify/${reference}`, {
		method: "POST",
	});

/** Who decided the Earn-Back deadline (§4.11.1). */
export type EarnBackDeadlineSource = "creator" | "provisional" | "learner";

export interface EarnBackStatus {
	base: number;
	currency: string;
	deadline: string | null;
	phase: "escrowed" | "resolved";
	refundAmount: number | null;
	/** `pending` = queued, gateway not yet acknowledged (§4.11.5). */
	outcome: "pending" | "processed" | "no_payout" | "failed" | null;
	/** When the gateway confirmed the refund — anchors the learner's ETA. */
	refundedAt: string | null;
	deadlineSource: EarnBackDeadlineSource | null;
	/** True while the learner still owes us a deadline choice. */
	canSetDeadline: boolean;
	/** The frozen window — the ceiling on what the learner may commit to. */
	maxDays: number | null;
}

/** The learner's earn-back status for a paid entity (null when not applicable). */
export const getEarnBackStatus = (type: EnrollableType, id: string) =>
	apiFetch<EarnBackStatus | null>(`/payments/earn-back/${type}/${id}`);

/**
 * Commit to a personal Earn-Back deadline (§4.11.1). Allowed once, only when
 * the creator left the window open, and only for a value at or inside it.
 */
export const setEarnBackDeadline = (
	type: EnrollableType,
	id: string,
	days: number,
) =>
	apiFetch<{ deadline: string; days: number }>(
		`/payments/earn-back/${type}/${id}/deadline`,
		{ method: "POST", body: JSON.stringify({ days }) },
	);

/**
 * Public settlement terms (§2): the non-refundable platform fee `pct`, plus the
 * creator's share of settled revenue — which the authoring UI needs to show a
 * creator what they actually keep at their chosen Earn-Back percentage.
 */
export const getPlatformFeePct = () =>
	apiFetch<{ pct: number; instructorSharePct: number }>(
		"/payments/platform-fee",
	);

/** The platform's Earn-Back window ceiling (§4.11.3) — "up to N days". */
export const getEarnBackWindow = () =>
	apiFetch<{ maxDays: number }>("/payments/earn-back-window");
