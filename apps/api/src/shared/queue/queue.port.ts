/**
 * Background-queue PORT (§6.4). Producers enqueue jobs and worker services
 * register processors through this interface, never touching BullMQ or Redis
 * directly. Two adapters implement it:
 *
 *  - `BullMqQueueAdapter`   — durable, Redis-backed, retryable. Selected when a
 *    dedicated persistent Redis is configured (`QUEUE_REDIS_URL`) — see
 *    `isQueueDurable()`. This is the paid/scaled path.
 *  - `InlineQueueAdapter`   — runs jobs in-process, no Redis at all. The free-tier
 *    default, so the metered cache Redis is never hammered by blocking workers.
 *
 * Swapping between them is a deploy-time env flip; no producer/worker code
 * changes. That is the whole point of the port.
 */
export const QUEUE_PORT = Symbol("QUEUE_PORT");

/** Per-job handle passed to a processor (progress reporting only, for now). */
export interface JobContext {
	/** Report 0–100% completion (drives the media "processing" UI). */
	updateProgress(percent: number): Promise<void>;
}

/** A processor for one queue: pure work over the job payload. */
export type JobHandler<T> = (data: T, ctx: JobContext) => Promise<void>;

export interface EnqueueOptions {
	/** Idempotency/dedupe key — a job already present with this id is not re-added. */
	jobId?: string;
	/** Total attempts including the first (default 1). */
	attempts?: number;
	/** Base delay (ms) between retries; grows exponentially per attempt. */
	backoffMs?: number;
	/** Groups jobs for progress lookup (media passes the lessonId). */
	groupKey?: string;
}

export type JobState =
	| "waiting"
	| "active"
	| "completed"
	| "failed"
	| "not_found";

export interface JobProgress {
	state: JobState;
	/** 0–100. */
	progress: number;
	jobId: string | null;
	failedReason?: string | null;
}

export interface QueuePort {
	/**
	 * Register the processor for a queue. Called once by each worker service at
	 * module init. With BullMQ this spins up a `Worker`; inline it just stores the
	 * handler so `enqueue` can run it.
	 */
	register<T>(
		queue: string,
		handler: JobHandler<T>,
		opts?: { concurrency?: number },
	): void;

	/** Enqueue a job; returns its id. */
	enqueue<T>(queue: string, data: T, opts?: EnqueueOptions): Promise<string>;

	/**
	 * Latest job progress for a group (e.g. a lesson's media job). `ready` lets
	 * the adapter report 100% when the artefact already exists but the job record
	 * has aged out.
	 */
	progressForGroup(
		queue: string,
		groupKey: string,
		ready: boolean,
	): Promise<JobProgress>;
}
