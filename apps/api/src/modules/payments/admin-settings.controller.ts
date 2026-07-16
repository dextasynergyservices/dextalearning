import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsArray, IsInt, IsString } from "class-validator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { PlatformSettingsService } from "../../shared/settings/platform-settings.service";
import { AdminSettingsService } from "./admin-settings.service";

class UpdateSettingDto {
	@IsString()
	key!: string;

	@IsInt()
	value!: number;
}

class UpdateProvidersDto {
	@IsArray()
	@IsString({ each: true })
	providers!: string[];
}

/**
 * Admin payment-settings surface (§2, §14). Admin-only. Read the current
 * money-governing settings + their bounds, and update one at a time.
 */
@ApiTags("admin-settings")
@ApiCookieAuth("better-auth.session_token")
@Controller("admin/settings")
@UseGuards(SessionGuard, RolesGuard)
@Roles("admin")
export class AdminSettingsController {
	constructor(private readonly adminSettings: AdminSettingsService) {}

	@Get("payments")
	@ApiOperation({ summary: "Payment settings + their bounds" })
	async payments() {
		const [settings, providers] = await Promise.all([
			this.adminSettings.getPaymentSettings(),
			this.adminSettings.getPaymentProviders(),
		]);
		return {
			settings,
			providers,
			allProviders: [...PlatformSettingsService.ALL_PAYMENT_PROVIDERS],
		};
	}

	@Patch("payments/providers")
	@ApiOperation({
		summary: "Choose which payment methods are offered at checkout (§14.1)",
	})
	async updateProviders(
		@Body() dto: UpdateProvidersDto,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return {
			providers: await this.adminSettings.updatePaymentProviders(
				dto.providers,
				user.id,
			),
		};
	}

	@Patch("payments")
	@ApiOperation({ summary: "Update a payment setting (bounded)" })
	async update(
		@Body() dto: UpdateSettingDto,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return {
			settings: await this.adminSettings.update(dto.key, dto.value, user.id),
		};
	}
}
