import { Controller, HttpCode, Logger, Post, UseGuards } from "@nestjs/common";
import { ApiExcludeController, ApiOperation } from "@nestjs/swagger";
import { CronSecretGuard } from "../../common/guards/cron-secret.guard";
import { CoachService } from "../coach/coach.service";
import { DropoffService } from "../dropoff/dropoff.service";
import { EarnBackService } from "../payments/earn-back.service";
import { LifecycleRemindersService } from "../reminders/lifecycle-reminders.service";
import { RemindersService } from "../reminders/reminders.service";

/**
 * Scheduled sweeps, triggered by an EXTERNAL scheduler over HTTP.
 *
 * The app runs scale-to-zero, so in-process `@Cron` only fires when the
 * container happens to be awake — which for a nightly sweep is "sometimes".
 * Set `SCHEDULERS_ENABLED=false` in production and drive these instead: the
 * request wakes the container, the sweep runs, it sleeps again. That is what
 * the serverless plan is good at, and it costs one short request per sweep.
 *
 * ⚠️ `SCHEDULERS_ENABLED` is opt-OUT — leaving it unset means the in-process
 * crons DO run, and you would then be sweeping twice.
 *
 * Every sweep here is idempotent (`ReminderLog` dedup, or already-resolved
 * rows), so a scheduler that retries on timeout cannot double-charge, double-pay
 * or double-notify. Hidden from Swagger: it's machine plumbing, not public API.
 */
@ApiExcludeController()
@Controller("internal/sweeps")
@UseGuards(CronSecretGuard)
export class SweepsController {
	private readonly logger = new Logger(SweepsController.name);

	constructor(
		private readonly reminders: RemindersService,
		private readonly lifecycle: LifecycleRemindersService,
		private readonly earnBack: EarnBackService,
		private readonly dropoff: DropoffService,
		private readonly coach: CoachService,
	) {}

	/**
	 * The one that moves money: releases escrowed Earn-Back at the deadline —
	 * learner refunds and instructor forfeits. If this stops running, people are
	 * owed money they don't receive, so schedule it first and watch it.
	 */
	@Post("earn-back")
	@HttpCode(200)
	@ApiOperation({ summary: "Resolve lapsed Earn-Back deadlines" })
	async earnBackSweep() {
		const resolved = await this.earnBack.resolveExpired();
		this.logger.log(`[sweep] earn-back resolved ${resolved} order(s)`);
		return { ok: true, resolved };
	}

	@Post("reminders")
	@HttpCode(200)
	@ApiOperation({ summary: "Streak + spaced-repetition digest sweep" })
	async remindersSweep() {
		const { sent } = await this.reminders.sweep();
		this.logger.log(`[sweep] reminders sent ${sent}`);
		return { ok: true, sent };
	}

	/** Cohort kickoff + deadline-approaching. Catch-up-safe, so a missed run is
	 *  recovered by the next one rather than lost. */
	@Post("lifecycle")
	@HttpCode(200)
	@ApiOperation({ summary: "Cohort kickoff + deadline notices" })
	async lifecycleSweep() {
		const { kickoffs, deadlines } = await this.lifecycle.sweep();
		this.logger.log(
			`[sweep] lifecycle ${kickoffs} kickoff(s), ${deadlines} due`,
		);
		return { ok: true, kickoffs, deadlines };
	}

	@Post("dropoff")
	@HttpCode(200)
	@ApiOperation({ summary: "Drop-off risk sweep" })
	async dropoffSweep() {
		const result = await this.dropoff.sweep();
		this.logger.log("[sweep] dropoff complete");
		return { ok: true, ...result };
	}

	@Post("coach")
	@HttpCode(200)
	@ApiOperation({ summary: "Weekly coaching digest sweep" })
	async coachSweep() {
		const { sent } = await this.coach.sweep();
		this.logger.log(`[sweep] coach sent ${sent}`);
		return { ok: true, sent };
	}
}
