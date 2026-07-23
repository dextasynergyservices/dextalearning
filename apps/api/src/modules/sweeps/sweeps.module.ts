import { Module } from "@nestjs/common";
import { CoachModule } from "../coach/coach.module";
import { DropoffModule } from "../dropoff/dropoff.module";
import { PaymentsModule } from "../payments/payments.module";
import { RemindersModule } from "../reminders/reminders.module";
import { SweepsController } from "./sweeps.controller";

/**
 * HTTP triggers for the scheduled sweeps (see the controller for why they exist).
 * Owns no state and no logic — it borrows each context's own sweep so there is
 * exactly one implementation per sweep, whether it's fired by in-process cron or
 * by the external scheduler.
 */
@Module({
	imports: [RemindersModule, PaymentsModule, DropoffModule, CoachModule],
	controllers: [SweepsController],
})
export class SweepsModule {}
