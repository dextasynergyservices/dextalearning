import { Global, Module } from "@nestjs/common";
import { NOTIFICATION_PORT } from "./notification.port";
import { ResendTermiiAdapter } from "./resend-termii.adapter";

/**
 * Binds the `NotificationPort` to the Resend/Termii adapter. Global so any
 * bounded context can depend on the port without importing provider
 * internals (§6.4) — mirrors StorageModule/EncodingModule/AiModule.
 */
@Global()
@Module({
	providers: [{ provide: NOTIFICATION_PORT, useClass: ResendTermiiAdapter }],
	exports: [NOTIFICATION_PORT],
})
export class NotificationsPortModule {}
