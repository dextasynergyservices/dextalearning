import { randomUUID } from "node:crypto";

/**
 * Minimal in-memory stand-in for a BullMQ `Queue` — implements only the
 * subset `MediaService` actually calls (`add`, `getJobs`). Avoids requiring a
 * real Redis instance for integration tests; cast with `as unknown as Queue`
 * at the injection site since this doesn't implement bullmq's full surface.
 */
export class FakeQueue {
	private jobs: {
		id: string;
		data: unknown;
		timestamp: number;
		progress: number;
	}[] = [];

	async add(_name: string, data: unknown): Promise<{ id: string }> {
		const job = { id: randomUUID(), data, timestamp: Date.now(), progress: 0 };
		this.jobs.push(job);
		return { id: job.id };
	}

	async getJobs() {
		return this.jobs.map((j) => ({
			id: j.id,
			data: j.data,
			timestamp: j.timestamp,
			progress: j.progress,
			failedReason: null,
			processedOn: null,
			finishedOn: null,
			getState: async () => "waiting" as const,
		}));
	}
}
