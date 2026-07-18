import { describe, expect, it, vi } from "vitest";
import { InlineQueueAdapter } from "./inline-queue.adapter";

/** Resolves once the adapter has drained the queue's serial chain. */
function flush(): Promise<void> {
	return new Promise((r) => setTimeout(r, 0));
}

describe("InlineQueueAdapter", () => {
	it("runs a registered handler with the job data (no Redis)", async () => {
		const q = new InlineQueueAdapter();
		const seen: unknown[] = [];
		q.register<{ id: string }>("video", async (data) => {
			seen.push(data);
		});
		await q.enqueue("video", { id: "abc" }, { groupKey: "abc" });
		await flush();
		expect(seen).toEqual([{ id: "abc" }]);
	});

	it("reports progress + completion for the group", async () => {
		const q = new InlineQueueAdapter();
		q.register<{ id: string }>("video", async (_data, ctx) => {
			await ctx.updateProgress(42);
		});
		await q.enqueue("video", { id: "x" }, { groupKey: "x" });
		await flush();
		const status = await q.progressForGroup("video", "x", false);
		expect(status.state).toBe("completed");
		expect(status.progress).toBe(100);
	});

	it("retries with the configured attempts, then succeeds", async () => {
		const q = new InlineQueueAdapter();
		const handler = vi
			.fn()
			.mockRejectedValueOnce(new Error("transient"))
			.mockResolvedValueOnce(undefined);
		q.register("payout", handler);
		await q.enqueue(
			"payout",
			{ payoutId: "p1" },
			{ attempts: 2, backoffMs: 0 },
		);
		await flush();
		await flush();
		expect(handler).toHaveBeenCalledTimes(2);
	});

	it("marks a job failed after exhausting attempts", async () => {
		const q = new InlineQueueAdapter();
		q.register("payout", async () => {
			throw new Error("permanent");
		});
		await q.enqueue("payout", { id: "p" }, { attempts: 1, groupKey: "p" });
		await flush();
		const status = await q.progressForGroup("payout", "p", false);
		expect(status.state).toBe("failed");
		expect(status.failedReason).toContain("permanent");
	});

	it("dedupes a still-running job by jobId (like BullMQ)", async () => {
		const q = new InlineQueueAdapter();
		const handler = vi
			.fn()
			.mockImplementation(() => new Promise((r) => setTimeout(r, 20)));
		q.register("payout", handler);
		await q.enqueue("payout", { id: 1 }, { jobId: "same" });
		await q.enqueue("payout", { id: 2 }, { jobId: "same" }); // ignored while active
		await new Promise((r) => setTimeout(r, 40));
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("returns not_found for an unknown group", async () => {
		const q = new InlineQueueAdapter();
		const status = await q.progressForGroup("video", "nope", false);
		expect(status.state).toBe("not_found");
		expect(status.progress).toBe(0);
	});
});
