import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import { AdminEarningsService } from "./admin-earnings.service";

/**
 * Platform earnings surface (§2, §15). Admin-only, read-only: what the platform
 * has taken across every settled order, and where it came from.
 */
@ApiTags("admin-earnings")
@ApiCookieAuth("better-auth.session_token")
@Controller("admin/earnings")
@UseGuards(SessionGuard, RolesGuard)
@Roles("admin")
export class AdminEarningsController {
	constructor(private readonly earnings: AdminEarningsService) {}

	@Get()
	@ApiOperation({ summary: "Platform earnings totals + per-entity breakdown" })
	async overview(@Query("limit") limit?: string) {
		const [summary, entities] = await Promise.all([
			this.earnings.summary(),
			this.earnings.byEntity(limit ? Number(limit) : undefined),
		]);
		return { summary, entities };
	}
}
