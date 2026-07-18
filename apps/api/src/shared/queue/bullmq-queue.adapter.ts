import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { type ConnectionOptions, type Job, Queue, Worker } from "bullmq";
import type {
	EnqueueOptions,
	JobHandler,
	JobProgress,
	JobState,
	QueuePort,
} from "./queue.port";

/** Reserved job-data field carrying the progress group key (e.g. lessonId). */
const GROUP_FIELD = "__group";
const JOB_STATUS_TYPES = [
	"active",
	"waiting",
	"delayed",
	"completed",
	"failed",
] as const;

/**
 * Durable `QueuePort` over BullMQ + Redis (§6.1 worker layer) — the same
 * behaviour the workers had inline before the port existed, now behind the
 * interface. Selected only when a dedicated persistent Redis is configured
 * (`isQueueDurable()`), since BullMQ's blocking workers must never run on the
 * metered cache Redis. Producer/worker code is identical to the inline path.
 */
@Injectable()
export class BullMqQueueAdapter implements QueuePort, OnModuleDestroy {
	private readonly logger = new Logger(BullMqQueueAdapter.name);
	private readonly connection: ConnectionOptions;
	private readonly queues = new Map<string, Queue>();
	private readonly workers: Worker[] = [];

	constructor() {
		const url = new URL(
			// Prefer the dedicated persistent Redis; fall back to the shared one only
			// in a full multi-instance deploy (isQueueDurable gates this class).
			process.env.QUEUE_REDIS_URL ??
				process.env.REDIS_URL ??
				"redis://localhost:6379",
		);
		this.connection = {
			host: url.hostname,
			port: Number(url.port || 6379),
			username: url.username || undefined,
			password: url.password || undefined,
			tls: url.protocol === "rediss:" ? {} : undefined,
			maxRetriesPerRequest: null,
		};
	}

	private queueFor(name: string): Queue {
		let queue = this.queues.get(name);
		if (!queue) {
			queue = new Queue(name, { connection: this.connection });
			this.queues.set(name, queue);
		}
		return queue;
	}

	register<T>(
		queue: string,
		handler: JobHandler<T>,
		opts?: { concurrency?: number },
	): void {
		const worker = new Worker<T>(
			queue,
			(job: Job<T>) =>
				handler(job.data, {
					updateProgress: (p: number) => job.updateProgress(p),
				}),
			{
				connection: this.connection,
				// Idle poll blocks Redis for 60s instead of the 5s default — ~12× fewer
				// idle commands (matters even on a persistent Redis); pickup latency is
				// irrelevant for encodes/payouts.
				drainDelay: 60,
				concurrency: opts?.concurrency ?? 1,
			},
		);
		worker.on("failed", (job, err) =>
			this.logger.error(`Job ${job?.id} on "${queue}" failed: ${err.message}`),
		);
		this.workers.push(worker);
	}

	async enqueue<T>(
		queue: string,
		data: T,
		opts?: EnqueueOptions,
	): Promise<string> {
		const payload = opts?.groupKey
			? { ...data, [GROUP_FIELD]: opts.groupKey }
			: data;
		const job = await this.queueFor(queue).add(queue, payload, {
			jobId: opts?.jobId,
			attempts: opts?.attempts ?? 1,
			...(opts?.backoffMs
				? { backoff: { type: "exponential", delay: opts.backoffMs } }
				: {}),
			removeOnComplete: 1000,
			removeOnFail: 1000,
		});
		return job.id ?? "";
	}

	async progressForGroup(
		queue: string,
		groupKey: string,
		ready: boolean,
	): Promise<JobProgress> {
		const jobs = await this.queueFor(queue).getJobs(
			[...JOB_STATUS_TYPES],
			0,
			50,
			false,
		);
		const matches = jobs.filter((job) => {
			const d = job.data as Record<string, unknown>;
			return d[GROUP_FIELD] === groupKey || d.lessonId === groupKey;
		});
		matches.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
		const job = matches[0];
		if (!job) {
			return {
				state: ready ? "completed" : "not_found",
				progress: ready ? 100 : 0,
				jobId: null,
			};
		}
		const state = (await job.getState()) as JobState;
		const raw = job.progress;
		const progress =
			typeof raw === "number"
				? Math.max(0, Math.min(100, raw))
				: ready
					? 100
					: 0;
		return {
			state,
			progress,
			jobId: job.id ?? null,
			failedReason: job.failedReason || null,
		};
	}

	async onModuleDestroy(): Promise<void> {
		await Promise.all(this.workers.map((w) => w.close()));
		await Promise.all([...this.queues.values()].map((q) => q.close()));
	}
}
