import { Module } from "@nestjs/common";
import { EnrollmentModule } from "../enrollment/enrollment.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AdminEarningsController } from "./admin-earnings.controller";
import { AdminEarningsService } from "./admin-earnings.service";
import { AdminPayoutsController } from "./admin-payouts.controller";
import { AdminPayoutsService } from "./admin-payouts.service";
import { AdminSettingsController } from "./admin-settings.controller";
import { AdminSettingsService } from "./admin-settings.service";
import { EarnBackEventsHandler } from "./earn-back.events-handler";
import { EarnBackScheduler } from "./earn-back.scheduler";
import { EarnBackService } from "./earn-back.service";
import { EarnBackDeadlineService } from "./earn-back-deadline.service";
import { EarningsController } from "./earnings.controller";
import { EarningsService } from "./earnings.service";
import { PaymentGatewayRegistry } from "./payment-gateway.registry";
import { PaymentsController } from "./payments.controller";
import { PaymentsNotificationsHandler } from "./payments.notifications-handler";
import { PaymentsService } from "./payments.service";
import { PayoutAccountService } from "./payout-account.service";
import { PricingSnapshotService } from "./pricing-snapshot.service";
import { EarnBackWorker } from "./workers/earn-back.worker";
import { InstructorPayoutWorker } from "./workers/instructor-payout.worker";

/**
 * Payments bounded context (§14, §4.11, §8.5). Owns checkout, webhook
 * settlement, the two-pool split, the durable instructor-payout worker, payout
 * accounts + instructor/platform earnings reporting, and the payout-notification
 * edge. Depends on
 * Enrollment (unlock paid content) and Notifications (payout messages) via
 * their exported services; everything else (Prisma, Queue, PlatformSettings,
 * Cache) is global.
 */
@Module({
	imports: [EnrollmentModule, NotificationsModule],
	controllers: [
		PaymentsController,
		EarningsController,
		AdminPayoutsController,
		AdminSettingsController,
		AdminEarningsController,
	],
	providers: [
		PaymentsService,
		PricingSnapshotService,
		PaymentGatewayRegistry,
		PayoutAccountService,
		AdminPayoutsService,
		AdminSettingsService,
		AdminEarningsService,
		EarningsService,
		EarnBackService,
		EarnBackDeadlineService,
		EarnBackEventsHandler,
		EarnBackScheduler,
		InstructorPayoutWorker,
		EarnBackWorker,
		PaymentsNotificationsHandler,
	],
	exports: [PaymentsService, PricingSnapshotService, EarnBackService],
})
export class PaymentsModule {}
