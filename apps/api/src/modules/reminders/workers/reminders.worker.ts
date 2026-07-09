import {
	Inject,
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";
import { type ConnectionOptions, type Queue, Worker } from "bullmq";
import {
	QUEUE_CONNECTION,
	QUEUE_REMINDERS,
	REMINDERS_QUEUE,
} from "../../../shared/queue/queue.constants";
import { RemindersService } from "../reminders.service";

/**
 * Hourly reminder sweep (§6.4: BullMQ for durable cross-context workflows).
 * A BullMQ job scheduler — not @nestjs/schedule — so the tick is persisted
 * in Redis, survives restarts, and stays single-fire across instances.
 */
@Injectable()
export class RemindersWorker implements OnModuleInit, OnModuleDestroy {
	private readonly logger = new Logger(RemindersWorker.name);
	private worker: Worker | null = null;

	constructor(
		@Inject(QUEUE_CONNECTION) private readonly connection: ConnectionOptions,
		@Inject(REMINDERS_QUEUE) private readonly queue: Queue,
		private readonly reminders: RemindersService,
	) {}

	async onModuleInit(): Promise<void> {
		this.worker = new Worker(
			QUEUE_REMINDERS,
			async () => {
				const { sent } = await this.reminders.sweep();
				if (sent > 0) this.logger.log(`reminder sweep sent ${sent} digest(s)`);
			},
			{ connection: this.connection, concurrency: 1 },
		);
		this.worker.on("failed", (_job, err) =>
			this.logger.error(`reminder sweep failed: ${err.message}`),
		);
		await this.queue.upsertJobScheduler(
			"reminders-hourly",
			{ pattern: "0 * * * *" },
			{ name: "sweep" },
		);
	}

	async onModuleDestroy(): Promise<void> {
		await this.worker?.close();
	}
}
