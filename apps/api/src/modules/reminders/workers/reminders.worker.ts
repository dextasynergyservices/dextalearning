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

	onModuleInit(): void {
		// `new Worker(...)` connects lazily — it never blocks boot.
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
		// Register the recurring sweep OFF the boot critical path. Awaiting this
		// Redis round-trip here used to block `app.listen()` (Nest waits for all
		// onModuleInit hooks): if Redis was briefly unreachable during a deploy,
		// the connection retried forever, the server never opened its port, and
		// the platform healthcheck failed with NO error in the logs (a hang, not
		// a crash). Fire-and-forget with a logged catch instead — the command
		// flushes automatically once Redis connects, so the schedule still lands.
		this.queue
			.upsertJobScheduler(
				"reminders-hourly",
				{ pattern: "0 * * * *" },
				{ name: "sweep" },
			)
			.then(() => this.logger.log("reminders-hourly scheduler registered"))
			.catch((err: unknown) =>
				this.logger.error(
					`failed to register reminders scheduler: ${
						err instanceof Error ? err.message : String(err)
					}`,
				),
			);
	}

	async onModuleDestroy(): Promise<void> {
		await this.worker?.close();
	}
}
