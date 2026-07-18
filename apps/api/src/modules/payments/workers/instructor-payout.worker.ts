import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../../prisma/prisma.service";
import {
	PaymentEvents,
	type PayoutFailedEvent,
	type PayoutProcessedEvent,
} from "../../../shared/events/payment-events";
import {
	type InstructorPayoutJobData,
	QUEUE_INSTRUCTOR_PAYOUT,
} from "../../../shared/queue/queue.constants";
import { QUEUE_PORT, type QueuePort } from "../../../shared/queue/queue.port";
import { PaymentGatewayRegistry } from "../payment-gateway.registry";

/**
 * Instructor-payout processor (§8.5, §14.2). Reads the pending payout row, and
 * if the instructor has a VERIFIED payout account attempts the gateway transfer;
 * otherwise the payout stays `pending` and accumulates until Admin triggers a
 * bulk payout (§14.3). Success/failure emit domain events that Notifications
 * turns into email/WhatsApp/in-app (§8.6). Serves both guaranteed-revenue
 * settlement and earn-back forfeiture payouts. Registered on the QueuePort —
 * durable under BullMQ, in-process on the free tier (idempotent on the row state).
 */
@Injectable()
export class InstructorPayoutWorker implements OnModuleInit {
	private readonly logger = new Logger(InstructorPayoutWorker.name);

	constructor(
		@Inject(QUEUE_PORT) private readonly queue: QueuePort,
		private readonly prisma: PrismaService,
		private readonly gateways: PaymentGatewayRegistry,
		private readonly events: EventEmitter2,
	) {}

	onModuleInit(): void {
		this.queue.register<InstructorPayoutJobData>(
			QUEUE_INSTRUCTOR_PAYOUT,
			(data) => this.process(data.payoutId),
			{ concurrency: 2 },
		);
	}

	private async process(payoutId: string): Promise<void> {
		const payout = await this.prisma.instructorPayout.findUnique({
			where: { id: payoutId },
			include: {
				order: { select: { entityTitle: true, userId: true } },
			},
		});
		if (!payout?.instructorId || !payout.amount) return;
		if (payout.status === "processed") return; // idempotent

		const amount = Number(payout.amount);
		const currency = payout.currency ?? "NGN";
		const entityTitle = payout.order?.entityTitle ?? "your content";

		// Pay to the instructor's chosen DEFAULT verified account (§14.3). None
		// yet → leave pending; Admin bulk-pays once one is set.
		const account = await this.prisma.payoutAccount.findFirst({
			where: {
				userId: payout.instructorId,
				isDefault: true,
				verified: true,
			},
		});
		if (!account) {
			this.logger.log(
				`Payout ${payoutId} held pending — instructor has no default verified payout account`,
			);
			return;
		}

		const learnerName = await this.learnerName(payout.order?.userId ?? null);
		const provider = account.provider;
		const result = await this.gateways.forProvider(provider).createTransfer({
			amountMinor: Math.round(amount * 100),
			currency,
			account: account.accountJson as Record<string, unknown>,
			reason: `DextaLearning payout — ${entityTitle}`,
			idempotencyKey: `payout:${payoutId}`,
		});

		if (result.status === "processed") {
			await this.prisma.instructorPayout.update({
				where: { id: payoutId },
				data: {
					status: "processed",
					provider,
					providerRef: result.providerRef,
					processedAt: new Date(),
				},
			});
			this.events.emit(PaymentEvents.PayoutProcessed, {
				payoutId,
				instructorId: payout.instructorId,
				amount,
				currency,
				entityTitle,
				learnerName,
			} satisfies PayoutProcessedEvent);
		} else {
			await this.prisma.instructorPayout.update({
				where: { id: payoutId },
				data: { status: "failed", failedReason: result.failedReason },
			});
			this.events.emit(PaymentEvents.PayoutFailed, {
				payoutId,
				instructorId: payout.instructorId,
				amount,
				currency,
				entityTitle,
				reason: result.failedReason ?? "Unknown error",
			} satisfies PayoutFailedEvent);
			// Re-throw so BullMQ retries with backoff (transfers can be transient).
			throw new Error(result.failedReason ?? "Transfer failed");
		}
	}

	private async learnerName(userId: string | null): Promise<string> {
		if (!userId) return "a learner";
		const u = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { fullName: true, firstName: true },
		});
		return u?.fullName ?? u?.firstName ?? "a learner";
	}
}
