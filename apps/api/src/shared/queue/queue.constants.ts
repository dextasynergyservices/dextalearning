/** Queue names (§6.1 worker layer). Passed to the QueuePort by producers +
 *  workers; the adapter (BullMQ or inline) maps them to real queues. */
export const QUEUE_VIDEO = "video";
export const QUEUE_AUDIO = "audio";
export const QUEUE_CAPTION = "caption";
export const QUEUE_INSTRUCTOR_PAYOUT = "instructor_payout";
export const QUEUE_EARN_BACK = "earn_back";

/**
 * A durable instructor payout (§8.5, §14.2). The row referenced by `payoutId`
 * (instructor_payouts) carries the amount/currency/instructor — the worker just
 * attempts the gateway transfer and records the outcome, so the same queue
 * serves both guaranteed-revenue settlement (D2) and earn-back forfeiture (D4).
 */
export interface InstructorPayoutJobData {
	payoutId: string;
}

/**
 * A durable Earn-Back refund to the learner's original payment method (§4.11.5).
 * The row referenced by `transactionId` (earn_back_transactions) carries the
 * amount/currency/order — the worker just attempts the gateway refund and
 * records the outcome.
 */
export interface EarnBackJobData {
	transactionId: string;
}

export interface VideoJobData {
	lessonId: string;
	sourceKey: string;
	sourceExt: string;
	/** Probed at upload time — lets the worker pick a safe thumbnail seek point. */
	durationSec: number;
}

export interface AudioJobData {
	lessonId: string;
	sourceKey: string;
	sourceExt: string;
}

export interface CaptionJobData {
	lessonId: string;
	languageCode: "en" | "fr" | "es" | "pcm";
	sourceKey: string;
	isSrt: boolean;
	uploadedBy: string;
}
