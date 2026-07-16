import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { acquireCronLock } from "../../common/cron-lock";
import { CACHE_PORT, type CachePort } from "../../shared/cache/cache.port";
import { EarnBackService } from "./earn-back.service";

/**
 * In-process daily sweep that resolves Earn-Back orders whose window has fully
 * lapsed without completion (§4.11.3) — releasing the forfeited escrow to the
 * instructor. Runs on cron (not a blocking BullMQ worker) to spare serverless
 * Redis (same posture as the reminders/coach/dropoff sweeps); a time-bucketed
 * lock ensures exactly one instance runs it in a scaled deployment.
 */
@Injectable()
export class EarnBackScheduler {
	private readonly logger = new Logger(EarnBackScheduler.name);

	constructor(
		private readonly earnBack: EarnBackService,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
	) {}

	// 05:30 daily — off-peak, after the dropoff sweep.
	@Cron("30 5 * * *")
	async sweep(): Promise<void> {
		const bucket = new Date().toISOString().slice(0, 10);
		if (!(await acquireCronLock(this.cache, `cron:earnback:${bucket}`, 3600))) {
			return;
		}
		try {
			const resolved = await this.earnBack.resolveExpired();
			if (resolved > 0) {
				this.logger.log(`Earn-Back sweep resolved ${resolved} lapsed order(s)`);
			}
		} catch (error) {
			this.logger.error(`Earn-Back sweep failed: ${String(error)}`);
		}
	}
}
