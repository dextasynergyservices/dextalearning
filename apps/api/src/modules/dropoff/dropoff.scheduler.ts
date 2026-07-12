import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { acquireCronLock } from "../../common/cron-lock";
import { CACHE_PORT, type CachePort } from "../../shared/cache/cache.port";
import { DropoffService } from "./dropoff.service";

/**
 * Daily drop-off sweep (§4.10) — 06:00 UTC, in-process cron. A date-bucketed
 * lock makes it single-fire across instances (the sweep's delete-then-insert
 * per cohort isn't safe to run concurrently, so the lock matters here).
 */
@Injectable()
export class DropoffScheduler {
	private readonly logger = new Logger(DropoffScheduler.name);

	constructor(
		private readonly dropoff: DropoffService,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
	) {}

	@Cron("0 6 * * *")
	async run(): Promise<void> {
		const dayKey = `lock:dropoff:${new Date().toISOString().slice(0, 10)}`;
		if (!(await acquireCronLock(this.cache, dayKey, 12 * 3600))) return;
		try {
			const { cohorts, flagged } = await this.dropoff.sweep();
			this.logger.log(
				`dropoff sweep flagged ${flagged} learner(s) across ${cohorts} cohort(s)`,
			);
		} catch (error) {
			this.logger.error(`dropoff sweep failed: ${(error as Error).message}`);
		}
	}
}
