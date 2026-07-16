import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { PlatformSettingsService } from "../../../shared/settings/platform-settings.service";

const PROVIDERS = [...PlatformSettingsService.ALL_PAYMENT_PROVIDERS];

export class CheckoutDto {
	@ApiPropertyOptional({
		enum: PROVIDERS,
		description:
			"Preferred payment provider. Ignored unless Admin currently offers it; omit to use the currency's default (§14.1).",
	})
	@IsOptional()
	@IsIn(PROVIDERS)
	provider?: (typeof PROVIDERS)[number];
}
