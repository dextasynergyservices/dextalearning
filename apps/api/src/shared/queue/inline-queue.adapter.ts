import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import type {
	EnqueueOptions,
	JobHandler,
	JobProgress,
	QueuePort,
} from "./queue.port";

interface Registration {
	handler: JobHandler<unknown>;
	concurrency: number;
}

interface JobRecord {
	queue: string;
	group?: string;
	state: "waiting" | "active" | "completed" | "failed";
	progress: number;
	failedReason?: string | null;
	createdAt: number;
}

/**
 * In-process `QueuePort` — the FREE-TIER default (no Redis, no blocking poll).
 * Jobs run in the SAME instance right after they are enqueued, on a per-queue
 * serial chain (so a heavy ffmpeg encode never runs two at once), with
 * exponential-backoff retries. Progress is held in a small bounded map so the
 * media "processing" endpoint keeps working.
 *
 * Trade-off vs BullMQ: no cross-process durability — a crash/redeploy mid-job
 * loses it (the instructor re-uploads; the payout cron re-drives pending rows).
 * That is the accepted cost of $0 infra; provisioning `QUEUE_REDIS_URL` swaps in
 * the durable BullMQ adapter with no code change. See queue.port.ts.
 */
@Injectable()
export class InlineQueueAdapter implements QueuePort {
	private readonly logger = new Logger(InlineQueueAdapter.name);
	private readonly registrations = new Map<string, Registration>();
	/** Per-queue tail promise → serial execution within a queue. */
	private readonly chains = new Map<string, Promise<void>>();
	private readonly jobs = new Map<string, JobRecord>();
	/** `${queue}:${group}` → latest jobId, for progress lookups. */
	private readonly latestByGroup = new Map<string, string>();
	private static readonly MAX_TRACKED = 500;

	register<T>(
		queue: string,
		handler: JobHandler<T>,
		opts?: { concurrency?: number },
	): void {
		this.registrations.set(queue, {
			handler: handler as JobHandler<unknown>,
			concurrency: opts?.concurrency ?? 1,
		});
	}

	async enqueue<T>(
		queue: string,
		data: T,
		opts?: EnqueueOptions,
	): Promise<string> {
		const jobId = opts?.jobId ?? randomUUID();

		// Dedupe: a job with this id still pending/running is not re-run (mirrors
		// BullMQ's jobId de-duplication — the payout/earn-back retry keys rely on it).
		const existing = this.jobs.get(jobId);
		if (
			existing &&
			(existing.state === "waiting" || existing.state === "active")
		) {
			return jobId;
		}

		this.track(jobId, {
			queue,
			group: opts?.groupKey,
			state: "waiting",
			progress: 0,
			createdAt: Date.now(),
		});
		if (opts?.groupKey) {
			this.latestByGroup.set(`${queue}:${opts.groupKey}`, jobId);
		}

		// Chain onto the queue's serial tail; swallow errors so one bad job never
		// breaks the chain for the next.
		const prior = this.chains.get(queue) ?? Promise.resolve();
		const next = prior
			.catch(() => {})
			.then(() => this.run(queue, jobId, data, opts));
		this.chains.set(queue, next);
		return jobId;
	}

	async progressForGroup(
		queue: string,
		groupKey: string,
		ready: boolean,
	): Promise<JobProgress> {
		const jobId = this.latestByGroup.get(`${queue}:${groupKey}`);
		const rec = jobId ? this.jobs.get(jobId) : undefined;
		if (!rec) {
			return {
				state: ready ? "completed" : "not_found",
				progress: ready ? 100 : 0,
				jobId: null,
			};
		}
		return {
			state: rec.state,
			progress: rec.state === "completed" || ready ? 100 : rec.progress,
			jobId: jobId ?? null,
			failedReason: rec.failedReason ?? null,
		};
	}

	private async run<T>(
		queue: string,
		jobId: string,
		data: T,
		opts?: EnqueueOptions,
	): Promise<void> {
		const reg = this.registrations.get(queue);
		if (!reg) {
			this.logger.warn(`No handler registered for queue "${queue}"`);
			return;
		}
		const attempts = Math.max(1, opts?.attempts ?? 1);
		const base = opts?.backoffMs ?? 0;
		const ctx = {
			updateProgress: async (percent: number) => {
				const rec = this.jobs.get(jobId);
				if (rec) rec.progress = Math.max(0, Math.min(100, percent));
			},
		};

		for (let attempt = 1; attempt <= attempts; attempt++) {
			const rec = this.jobs.get(jobId);
			if (rec) rec.state = "active";
			try {
				await reg.handler(data, ctx);
				const done = this.jobs.get(jobId);
				if (done) {
					done.state = "completed";
					done.progress = 100;
				}
				return;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				if (attempt < attempts) {
					const delay = base * 2 ** (attempt - 1);
					this.logger.warn(
						`Job ${jobId} on "${queue}" failed (attempt ${attempt}/${attempts}), retrying in ${delay}ms: ${message}`,
					);
					if (delay > 0) await new Promise((r) => setTimeout(r, delay));
				} else {
					const failed = this.jobs.get(jobId);
					if (failed) {
						failed.state = "failed";
						failed.failedReason = message;
					}
					this.logger.error(
						`Job ${jobId} on "${queue}" failed after ${attempts} attempt(s): ${message}`,
					);
				}
			}
		}
	}

	private track(jobId: string, rec: JobRecord): void {
		this.jobs.set(jobId, rec);
		if (this.jobs.size > InlineQueueAdapter.MAX_TRACKED) {
			// Evict the oldest completed/failed records first.
			const oldest = [...this.jobs.entries()]
				.filter(([, r]) => r.state === "completed" || r.state === "failed")
				.sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
			if (oldest) this.jobs.delete(oldest[0]);
		}
	}
}
