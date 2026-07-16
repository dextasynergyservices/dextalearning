import {
	Inject,
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { type ConnectionOptions, type Job, Worker } from "bullmq";
import { PrismaService } from "../../../prisma/prisma.service";
import {
	type EarnBackFailedEvent,
	type EarnBackProcessedEvent,
	PaymentEvents,
} from "../../../shared/events/payment-events";
import {
	type EarnBackJobData,
	QUEUE_CONNECTION,
	QUEUE_EARN_BACK,
} from "../../../shared/queue/queue.constants";
import { PaymentGatewayRegistry } from "../payment-gateway.registry";

/**
 * Durable Earn-Back refund worker (§4.11.5). Reads the pending
 * `earn_back_transactions` row and refunds the learner's ORIGINAL payment
 * method via the gateway (No Wallet). Success/failure emit domain events that
 * Notifications turns into the learner's messages; a failure alerts Admin and
 * retries with backoff.
 */
@Injectable()
export class EarnBackWorker implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(EarnBackWorker.name);
	private worker?: Worker;

	constructor(
		@Inject(QUEUE_CONNECTION) private readonly connection: ConnectionOptions,
		private readonly prisma: PrismaService,
		private readonly gateways: PaymentGatewayRegistry,
		private readonly events: EventEmitter2,
	) {}

	onModuleInit(): void {
		this.worker = new Worker<EarnBackJobData>(
			QUEUE_EARN_BACK,
			(job: Job<EarnBackJobData>) => this.process(job.data.transactionId),
			{ connection: this.connection, drainDelay: 60, concurrency: 2 },
		);
		this.worker.on("failed", (job, err) => {
			this.logger.error(`Earn-Back job ${job?.id} failed: ${err.message}`);
		});
	}

	async onModuleDestroy(): Promise<void> {
		await this.worker?.close();
	}

	private async process(transactionId: string): Promise<void> {
		const tx = await this.prisma.earnBackTransaction.findUnique({
			where: { id: transactionId },
			include: {
				order: {
					select: { providerRef: true, provider: true, entityTitle: true },
				},
			},
		});
		if (!tx || tx.status === "processed") return; // idempotent
		if (!tx.earnBackAmount || Number(tx.earnBackAmount) <= 0) return;

		const amount = Number(tx.earnBackAmount);
		const currency = tx.currency ?? "NGN";
		const entityTitle = tx.order?.entityTitle ?? "your course";
		const reference = tx.order?.providerRef;
		if (!reference) {
			this.logger.error(`Earn-Back ${transactionId} has no original reference`);
			return;
		}

		const provider = this.gateways.providerForCurrency(currency);
		const result = await this.gateways.forProvider(provider).createRefund({
			amountMinor: Math.round(amount * 100),
			currency,
			originalReference: reference,
			reason: `DextaLearning Earn-Back — ${entityTitle}`,
			idempotencyKey: `earnback:${transactionId}`,
		});

		if (result.status === "processed") {
			await this.prisma.earnBackTransaction.update({
				where: { id: transactionId },
				data: {
					status: "processed",
					provider,
					providerRef: result.providerRef,
					processedAt: new Date(),
				},
			});
			this.events.emit(PaymentEvents.EarnBackProcessed, {
				transactionId,
				userId: tx.userId ?? "",
				amount,
				currency,
				entityTitle,
				daysLate: tx.daysLate,
			} satisfies EarnBackProcessedEvent);
		} else {
			await this.prisma.earnBackTransaction.update({
				where: { id: transactionId },
				data: { status: "failed", failedReason: result.failedReason },
			});
			this.events.emit(PaymentEvents.EarnBackFailed, {
				transactionId,
				userId: tx.userId ?? "",
				amount,
				currency,
				entityTitle,
				reason: result.failedReason ?? "Unknown error",
			} satisfies EarnBackFailedEvent);
			throw new Error(result.failedReason ?? "Refund failed");
		}
	}
}
