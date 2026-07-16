import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import { AdminPayoutsService } from "./admin-payouts.service";

/**
 * Admin payout oversight + bulk payout (§14.3). Admin-only. Lets Admin see
 * outstanding pending payouts grouped by instructor, trigger a bulk run, view
 * recent payout activity, and retry a failed payout.
 */
@ApiTags("admin-payouts")
@ApiCookieAuth("better-auth.session_token")
@Controller("admin/payouts")
@UseGuards(SessionGuard, RolesGuard)
@Roles("admin")
export class AdminPayoutsController {
	constructor(private readonly adminPayouts: AdminPayoutsService) {}

	@Get("pending")
	@ApiOperation({ summary: "Pending payouts grouped by instructor" })
	pending() {
		return this.adminPayouts.pending();
	}

	@Get()
	@ApiOperation({ summary: "Recent payout activity across all instructors" })
	async recent(@Query("limit") limit?: string) {
		return { payouts: await this.adminPayouts.recent(Number(limit) || 100) };
	}

	@Get("refunds")
	@ApiOperation({ summary: "Recent learner Earn-Back refunds" })
	async refunds(@Query("limit") limit?: string) {
		return {
			refunds: await this.adminPayouts.recentRefunds(Number(limit) || 100),
		};
	}

	@Post("run")
	@ApiOperation({ summary: "Bulk-run all eligible pending payouts" })
	runAll() {
		return this.adminPayouts.runAll();
	}

	@Post(":id/retry")
	@ApiOperation({ summary: "Retry a failed payout" })
	retry(@Param("id") id: string) {
		return this.adminPayouts.retry(id);
	}

	@Post("refunds/:id/retry")
	@ApiOperation({ summary: "Retry a failed learner Earn-Back refund" })
	retryRefund(@Param("id") id: string) {
		return this.adminPayouts.retryRefund(id);
	}
}
