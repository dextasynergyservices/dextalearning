import { randomUUID } from "node:crypto";
import type {
	EnqueueOptions,
	JobHandler,
	JobProgress,
	QueuePort,
} from "../../../../src/shared/queue/queue.port";

/**
 * In-memory `QueuePort` for tests — records enqueued jobs WITHOUT running the
 * handlers (producers are tested in isolation; the work itself is covered by
 * unit tests). Mirrors the old FakeQueue behaviour where `.add` just recorded.
 */
export class FakeQueuePort implements QueuePort {
	readonly enqueued: {
		queue: string;
		data: unknown;
		opts?: EnqueueOptions;
	}[] = [];

	register<T>(_queue: string, _handler: JobHandler<T>): void {}

	async enqueue<T>(
		queue: string,
		data: T,
		opts?: EnqueueOptions,
	): Promise<string> {
		this.enqueued.push({ queue, data, opts });
		return opts?.jobId ?? randomUUID();
	}

	async progressForGroup(
		_queue: string,
		_groupKey: string,
		ready: boolean,
	): Promise<JobProgress> {
		return {
			state: ready ? "completed" : "not_found",
			progress: ready ? 100 : 0,
			jobId: null,
		};
	}
}
