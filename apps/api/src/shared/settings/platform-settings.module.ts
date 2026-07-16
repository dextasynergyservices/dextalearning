import { Global, Module } from "@nestjs/common";
import { PlatformSettingsService } from "./platform-settings.service";

/**
 * Global so any bounded context (Content pricing guardrail, Payments
 * settlement, Earn-Back) can read the shared 90/10 / 60-day config off one
 * cached read model without re-wiring providers (§6.4).
 */
@Global()
@Module({
	providers: [PlatformSettingsService],
	exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
