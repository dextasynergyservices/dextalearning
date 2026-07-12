import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { acquireCronLock } from "../../common/cron-lock";
import { CACHE_PORT, type CachePort } from "../../shared/cache/cache.port";
import { RemindersService } from "./reminders.service";

/**
 * Hourly reminder sweep (§3.1/§3.2) via in-process cron — no always-blocking
 * BullMQ worker, so it costs serverless Redis one command per tick instead of
 * ~17k/day. A time-bucketed lock keeps it single-fire across instances; the
 * sweep is idempotent (ReminderLog dedup) so a fail-open double-run is safe.
 */
@Injectable()
export class RemindersScheduler {
	private readonly logger = new Logger(RemindersScheduler.name);

	constructor(
		private readonly reminders: RemindersService,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
	) {}

	@Cron("0 * * * *")
	async run(): Promise<void> {
		const hourKey = `lock:reminders:${new Date().toISOString().slice(0, 13)}`;
		if (!(await acquireCronLock(this.cache, hourKey, 3600))) return;
		try {
			const { sent } = await this.reminders.sweep();
			if (sent > 0) this.logger.log(`reminder sweep sent ${sent} digest(s)`);
		} catch (error) {
			this.logger.error(`reminder sweep failed: ${(error as Error).message}`);
		}
	}
}
