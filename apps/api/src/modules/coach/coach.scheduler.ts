import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { acquireCronLock } from "../../common/cron-lock";
import { CACHE_PORT, type CachePort } from "../../shared/cache/cache.port";
import { CoachService } from "./coach.service";

/**
 * Weekly Learning Coach sweep (§4.10) — Monday 08:00 UTC, in-process cron. A
 * date-bucketed lock makes it single-fire across instances; the sweep is
 * idempotent (CoachDigest unique [userId, weekOf]) so a fail-open double-run
 * can't double-send or double-bill the AI.
 */
@Injectable()
export class CoachScheduler {
	private readonly logger = new Logger(CoachScheduler.name);

	constructor(
		private readonly coach: CoachService,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
	) {}

	@Cron("0 8 * * 1")
	async run(): Promise<void> {
		const dayKey = `lock:coach:${new Date().toISOString().slice(0, 10)}`;
		if (!(await acquireCronLock(this.cache, dayKey, 12 * 3600))) return;
		try {
			const { sent } = await this.coach.sweep();
			if (sent > 0) this.logger.log(`coach sweep sent ${sent} digest(s)`);
		} catch (error) {
			this.logger.error(`coach sweep failed: ${(error as Error).message}`);
		}
	}
}
