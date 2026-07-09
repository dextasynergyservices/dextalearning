import { Logger } from "@nestjs/common";
import type { ConnectionOptions, Queue } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RemindersService } from "../reminders.service";
import { RemindersWorker } from "./reminders.worker";

// Stub BullMQ's Worker so no real Redis connection is opened in a unit test.
vi.mock("bullmq", () => ({
	Worker: class {
		on() {
			return this;
		}
		close() {
			return Promise.resolve();
		}
	},
}));

function build(upsertJobScheduler: () => Promise<unknown>) {
	const queue = {
		upsertJobScheduler: vi.fn().mockImplementation(upsertJobScheduler),
	} as unknown as Queue;
	const reminders = { sweep: vi.fn() } as unknown as RemindersService;
	const worker = new RemindersWorker({} as ConnectionOptions, queue, reminders);
	return { worker, queue };
}

describe("RemindersWorker", () => {
	afterEach(() => vi.restoreAllMocks());

	it("registers the hourly sweep scheduler on init", async () => {
		const { worker, queue } = build(() => Promise.resolve());
		worker.onModuleInit();
		// Fire-and-forget — flush the microtask queue, then assert.
		await Promise.resolve();
		expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
			"reminders-hourly",
			{ pattern: "0 * * * *" },
			{ name: "sweep" },
		);
	});

	it("does NOT block or throw when Redis registration fails (boot stays up)", async () => {
		const errorSpy = vi
			.spyOn(Logger.prototype, "error")
			.mockImplementation(() => undefined);
		const { worker } = build(() => Promise.reject(new Error("ECONNREFUSED")));

		// onModuleInit must return synchronously (void) — never awaiting Redis.
		expect(worker.onModuleInit()).toBeUndefined();

		// The rejected registration is caught and logged, not propagated.
		await Promise.resolve();
		await Promise.resolve();
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("failed to register reminders scheduler"),
		);
	});
});
