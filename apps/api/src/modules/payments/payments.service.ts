import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { type Queue } from "bullmq";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import {
	type PaymentConfirmedEvent,
	PaymentEvents,
} from "../../shared/events/payment-events";
import {
	INSTRUCTOR_PAYOUT_QUEUE,
	type InstructorPayoutJobData,
} from "../../shared/queue/queue.constants";
import type { EnrollableType } from "../enrollment/enrollment.service";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { canLearnerSetDeadline } from "./earn-back-deadline.calculator";
import type { PaymentProviderName } from "./payment-gateway.port";
import { PaymentGatewayRegistry } from "./payment-gateway.registry";
import { PricingSnapshotService } from "./pricing-snapshot.service";
import { calculateRevenueSplit } from "./revenue-split.calculator";

/** Minor units (kobo/cents) → major-unit number for Decimal columns. */
function toMajor(minor: number): number {
	return Math.round(minor) / 100;
}

/**
 * Payments context (§14, §4.11). Owns the paid-enrolment lifecycle: it snapshots
 * price + earn-back at checkout (§4.11.2), then on the verified gateway webhook
 * splits the payment into the two pools (§2), settles the guaranteed revenue
 * 90/10 via instructor_payout.queue, and unlocks the enrolment. All settlement
 * math reads the frozen Order snapshot — never the live catalogue.
 */
@Injectable()
export class PaymentsService {
	private readonly logger = new Logger(PaymentsService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly snapshots: PricingSnapshotService,
		private readonly gateways: PaymentGatewayRegistry,
		private readonly enrollment: EnrollmentService,
		private readonly events: EventEmitter2,
		@Inject(INSTRUCTOR_PAYOUT_QUEUE) private readonly payoutQueue: Queue,
	) {}

	/**
	 * Start a hosted checkout for a paid entity. Freezes the snapshot + pools onto
	 * a `pending` Order, then hands the learner a gateway authorization URL. Free
	 * content, missing content, and already-enrolled learners are rejected here so
	 * no dead order is created.
	 */
	async initCheckout(
		user: AuthenticatedUser,
		type: EnrollableType,
		entityId: string,
		requestedProvider?: PaymentProviderName,
	): Promise<{ authorizationUrl: string; orderId: string }> {
		if (await this.enrollment.isEnrolled(user.id, type, entityId)) {
			throw new ConflictException("Already enrolled in this content");
		}
		const snap = await this.snapshots.build(type, entityId);
		if (!snap) {
			throw new NotFoundException("Content is not available for purchase");
		}
		if (snap.priceMinor <= 0) {
			throw new BadRequestException("Content is free — enrol directly");
		}

		// Reuse an existing unpaid order for this learner+entity so a retried
		// checkout doesn't spawn duplicates.
		const existing = await this.prisma.order.findFirst({
			where: {
				userId: user.id,
				entityType: type,
				entityId,
				status: "pending",
			},
			select: { id: true },
		});

		const split = calculateRevenueSplit({
			priceMinor: snap.priceMinor,
			isEarnBackEligible: snap.isEarnBackEligible,
			earnBackPercentage: snap.earnBackPercentage,
			instructorSharePct: snap.revenueSplitPct,
			isPlatformOwned: snap.isPlatformOwned,
			platformFeePct: snap.platformFeePct,
		});

		// Admin's enabled-providers switch decides what's actually offered (§14.1);
		// the learner's choice only picks among those.
		const provider = await this.gateways.resolveProvider(
			snap.currency,
			requestedProvider,
		);
		const orderData = {
			userId: user.id,
			entityType: type,
			entityId,
			entityTitle: snap.title,
			amount: toMajor(snap.priceMinor),
			currency: snap.currency,
			instructorId: snap.instructorId,
			isPlatformOwned: snap.isPlatformOwned,
			isEarnBackEligible: snap.isEarnBackEligible,
			earnBackPercentage: snap.earnBackPercentage,
			// Freeze the window AND who decided it (§4.11.1). When the creator
			// left it open the platform max stands provisionally — so escrow is
			// always resolvable — and the learner may commit to any shorter value.
			earnBackDeadlineDays: snap.earnBackDeadlineDays ?? snap.earnBackMaxDays,
			earnBackDeadlineSource: snap.isEarnBackEligible
				? snap.earnBackDeadlineDays != null
					? ("creator" as const)
					: ("provisional" as const)
				: null,
			revenueSplitPct: snap.revenueSplitPct,
			platformFeePct: snap.platformFeePct,
			platformFee: toMajor(split.platformFeeMinor),
			earnBackBase: toMajor(split.earnBackBaseMinor),
			guaranteedRevenue: toMajor(split.guaranteedRevenueMinor),
			platformAmount: toMajor(split.platformAmountMinor),
			instructorAmount: toMajor(split.instructorAmountMinor),
			provider,
			status: "pending" as const,
		};

		const order = existing
			? await this.prisma.order.update({
					where: { id: existing.id },
					data: orderData,
					select: { id: true },
				})
			: await this.prisma.order.create({
					data: orderData,
					select: { id: true },
				});

		const callbackUrl = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/checkout/callback`;
		const { authorizationUrl, providerRef } = await this.gateways
			.forProvider(provider)
			.initTransaction({
				reference: order.id,
				amountMinor: snap.priceMinor,
				currency: snap.currency,
				email: user.email,
				callbackUrl,
				metadata: {
					entityType: type,
					entityId,
					entityTitle: snap.title,
				},
			});

		await this.prisma.order.update({
			where: { id: order.id },
			data: { providerRef, idempotencyKey: `order:${order.id}` },
		});

		return { authorizationUrl, orderId: order.id };
	}

	/**
	 * Handle a raw gateway webhook: verify the signature, parse it, and settle the
	 * matching order exactly once. Signature failure → false (caller 400s);
	 * anything already settled is a no-op (idempotent), so gateway retries are
	 * safe.
	 */
	async handleWebhook(
		provider: "paystack" | "stripe",
		rawBody: Buffer,
		signature: string | undefined,
	): Promise<{ handled: boolean }> {
		const gateway = this.gateways.forProvider(provider);
		if (!gateway.verifyWebhook(rawBody, signature)) {
			throw new BadRequestException("Invalid webhook signature");
		}
		const event = gateway.parseWebhook(rawBody);
		if (event.kind !== "charge.success" || !event.reference) {
			return { handled: false };
		}
		await this.settleOrder(event.reference, provider);
		return { handled: true };
	}

	/**
	 * Verify-on-callback (§14): the learner lands back on our callback page after
	 * paying; we ask the provider directly whether the charge succeeded and settle
	 * the order — so payment confirms even when the async webhook can't reach us
	 * (local dev, webhook delay/outage). Idempotent + owner-scoped; the webhook
	 * remains the backup path (both funnel through the same `settleOrder`).
	 */
	async verifyAndSettle(userId: string, reference: string) {
		const order = await this.prisma.order.findFirst({
			where: { id: reference, userId },
			select: {
				id: true,
				status: true,
				provider: true,
				providerRef: true,
				entityType: true,
				entityId: true,
				entityTitle: true,
			},
		});
		if (!order) throw new NotFoundException("Order not found");

		const view = (status: string) => ({
			status,
			entityType: order.entityType,
			entityId: order.entityId,
			entityTitle: order.entityTitle,
		});

		if (order.status === "paid" || order.status === "earn_back_issued") {
			return view(order.status);
		}
		const provider = order.provider ?? "paystack";
		const result = await this.gateways
			.forProvider(provider)
			.verifyTransaction(order.providerRef ?? order.id);

		if (result.status === "success") {
			await this.settleOrder(order.id, provider);
			return view("paid");
		}
		if (result.status === "failed") {
			await this.prisma.order.updateMany({
				where: { id: order.id, status: "pending" },
				data: { status: "failed" },
			});
			return view("failed");
		}
		return view(order.status ?? "pending");
	}

	/**
	 * The learner's Earn-Back status for an entity they paid for (§4.11), for the
	 * progress-page status card. Null when there is no paid earn-back order.
	 * `escrowed` = paid, awaiting completion (shows the deadline countdown);
	 * `resolved` carries the refund outcome.
	 */
	async earnBackStatus(
		userId: string,
		type: EnrollableType,
		entityId: string,
	): Promise<{
		base: number;
		currency: string;
		deadline: string | null;
		phase: "escrowed" | "resolved";
		refundAmount: number | null;
		/**
		 * `pending` = refund queued, gateway not yet acknowledged (§4.11.5); it is
		 * a real state the learner sits in for seconds-to-minutes, not an absence.
		 */
		outcome: "pending" | "processed" | "no_payout" | "failed" | null;
		/** When the gateway confirmed the refund — anchors the learner's ETA. */
		refundedAt: string | null;
		/** Who decided the deadline (§4.11.1) — drives the learner's prompt. */
		deadlineSource: "creator" | "provisional" | "learner" | null;
		/** True while the learner still owes us a deadline choice. */
		canSetDeadline: boolean;
		/** The frozen window: the ceiling on what the learner may commit to. */
		maxDays: number | null;
	} | null> {
		const order = await this.prisma.order.findFirst({
			where: {
				userId,
				entityType: type,
				entityId,
				isEarnBackEligible: true,
				status: { in: ["paid", "earn_back_issued"] },
			},
			orderBy: { createdAt: "desc" },
		});
		if (!order?.earnBackBase || Number(order.earnBackBase) <= 0) {
			return null;
		}
		const base = Number(order.earnBackBase);
		const currency = order.currency ?? "NGN";
		// The same pure rule the setter authorises against, so what the UI offers
		// and what the API permits can never drift apart (§4.11.1).
		const deadlineFields = {
			deadlineSource: order.earnBackDeadlineSource,
			canSetDeadline: canLearnerSetDeadline({
				isEarnBackEligible: order.isEarnBackEligible,
				status: order.status,
				earnBackDeadlineDays: order.earnBackDeadlineDays,
				earnBackDeadlineSource: order.earnBackDeadlineSource,
			}),
			maxDays: order.earnBackDeadlineDays,
		};
		if (order.status !== "earn_back_issued") {
			return {
				base,
				currency,
				deadline: order.earnBackDeadline?.toISOString() ?? null,
				phase: "escrowed",
				refundAmount: null,
				outcome: null,
				refundedAt: null,
				...deadlineFields,
			};
		}
		const txn = await this.prisma.earnBackTransaction.findFirst({
			where: { orderId: order.id },
			orderBy: { calculatedAt: "desc" },
		});
		return {
			base,
			currency,
			deadline: order.earnBackDeadline?.toISOString() ?? null,
			phase: "resolved",
			refundAmount: txn ? Number(txn.earnBackAmount ?? 0) : null,
			outcome:
				(txn?.status as
					| "pending"
					| "processed"
					| "no_payout"
					| "failed"
					| null) ?? null,
			refundedAt: txn?.processedAt?.toISOString() ?? null,
			...deadlineFields,
		};
	}

	/** Idempotent settlement of a single order (§2, §14.2). */
	private async settleOrder(
		orderId: string,
		provider: "paystack" | "stripe",
	): Promise<void> {
		const order = await this.prisma.order.findUnique({
			where: { id: orderId },
		});
		if (!order?.userId || !order.entityType || !order.entityId) {
			this.logger.warn(`Webhook for unknown/incomplete order ${orderId}`);
			return;
		}
		if (order.status === "paid" || order.status === "earn_back_issued") {
			return; // already settled — idempotent no-op
		}

		const paidAt = new Date();
		// Deadline = paid-at + the days FROZEN on the order at checkout (never a
		// live catalogue re-read), so a later window edit can't move it (§4.11.2).
		const earnBackDeadline =
			order.isEarnBackEligible && order.earnBackPercentage
				? new Date(
						paidAt.getTime() +
							(order.earnBackDeadlineDays ?? 60) * 24 * 60 * 60 * 1000,
					)
				: null;

		// Settle + create the instructor payout row atomically. The transfer
		// itself runs off the durable queue (retryable), not in this transaction.
		const payoutId = await this.prisma.$transaction(async (tx) => {
			const updated = await tx.order.updateMany({
				where: { id: orderId, status: "pending" },
				data: { status: "paid", provider, paidAt, earnBackDeadline },
			});
			if (updated.count === 0) return null; // lost the race — someone settled it

			// Guaranteed revenue settles now; platform-owned keeps 100% (no payout).
			if (
				!order.isPlatformOwned &&
				order.instructorId &&
				order.instructorAmount &&
				Number(order.instructorAmount) > 0
			) {
				const payout = await tx.instructorPayout.create({
					data: {
						orderId: order.id,
						instructorId: order.instructorId,
						amount: order.instructorAmount,
						currency: order.currency,
						provider,
						status: "pending",
					},
					select: { id: true },
				});
				return payout.id;
			}
			return null;
		});

		if (payoutId) {
			await this.payoutQueue.add(
				"payout",
				{ payoutId } satisfies InstructorPayoutJobData,
				{
					jobId: `payout-${payoutId}`,
					attempts: 5,
					backoff: { type: "exponential", delay: 30_000 },
					removeOnComplete: 1000,
					removeOnFail: 5000,
				},
			);
		}

		// Unlock the paid content (idempotent) and announce the confirmation.
		await this.enrollment.enrollAfterPayment(
			order.userId,
			order.entityType as EnrollableType,
			order.entityId,
		);
		this.events.emit(PaymentEvents.PaymentConfirmed, {
			orderId: order.id,
			userId: order.userId,
			entityType: order.entityType,
			entityId: order.entityId,
			entityTitle: order.entityTitle ?? "",
		} satisfies PaymentConfirmedEvent);

		this.logger.log(`Order ${orderId} settled via ${provider}`);
	}
}
