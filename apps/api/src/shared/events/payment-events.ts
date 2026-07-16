/**
 * Payment-domain events (§6.4: contexts communicate by events, not calls).
 * Emitted by the Payments context when money moves; consumed by Notifications
 * (payout emails/WhatsApp/in-app) and Enrollment (unlock paid content on
 * confirmation). Payloads are snapshots — consumers must not join back into the
 * Payments tables to enrich them (§6.4 rule 5).
 */
export const PaymentEvents = {
	PaymentConfirmed: "payment.confirmed",
	PayoutProcessed: "payment.payout.processed",
	PayoutFailed: "payment.payout.failed",
	EarnBackProcessed: "payment.earnback.processed",
	EarnBackNoPayout: "payment.earnback.no_payout",
	EarnBackFailed: "payment.earnback.failed",
} as const;

export interface PaymentConfirmedEvent {
	orderId: string;
	userId: string;
	entityType: "course" | "path" | "cohort";
	entityId: string;
	entityTitle: string;
}

export interface PayoutProcessedEvent {
	payoutId: string;
	instructorId: string;
	/** Major-unit amount (e.g. 900.00) for display in notifications. */
	amount: number;
	currency: string;
	entityTitle: string;
	/** The learner whose enrolment produced this payout, for the copy. */
	learnerName: string;
}

export interface PayoutFailedEvent {
	payoutId: string;
	instructorId: string;
	amount: number;
	currency: string;
	entityTitle: string;
	reason: string;
}

/** Earn-Back resolved with a refund on its way to the learner (§4.11.5). */
export interface EarnBackProcessedEvent {
	transactionId: string;
	userId: string;
	amount: number;
	currency: string;
	entityTitle: string;
	daysLate: number;
}

/** Earn-Back resolved with nothing to refund (base 0 or ≥50 days late). */
export interface EarnBackNoPayoutEvent {
	transactionId: string;
	userId: string;
	entityTitle: string;
}

/** The learner refund failed at the gateway — support steps in. */
export interface EarnBackFailedEvent {
	transactionId: string;
	userId: string;
	amount: number;
	currency: string;
	entityTitle: string;
	reason: string;
}
