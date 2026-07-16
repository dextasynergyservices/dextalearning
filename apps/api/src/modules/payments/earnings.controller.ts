import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { SetPaystackAccountDto } from "./dto/payout-account.dto";
import { EarningsService } from "./earnings.service";
import { PayoutAccountService } from "./payout-account.service";

/**
 * Instructor earnings + payout-account surface (§8.5, §14.3), backing
 * `/instructor/earnings`. Instructor-scoped (admins allowed) and always keyed
 * to the caller's own id — an instructor only ever sees their own payouts.
 */
@ApiTags("earnings")
@ApiCookieAuth("better-auth.session_token")
@Controller("payments")
@UseGuards(SessionGuard, RolesGuard)
@Roles("instructor")
export class EarningsController {
	constructor(
		private readonly earnings: EarningsService,
		private readonly payoutAccount: PayoutAccountService,
	) {}

	@Get("earnings")
	@ApiOperation({ summary: "Instructor earnings summary + payout history" })
	async getEarnings(@CurrentUser() user: AuthenticatedUser) {
		const [summary, history] = await Promise.all([
			this.earnings.summary(user.id),
			this.earnings.history(user.id),
		]);
		return { summary, history };
	}

	@Get("earnings/ledger")
	@ApiOperation({
		summary: "The instructor's Earn-Back ledger — every sale and its outcome",
	})
	getLedger(@CurrentUser() user: AuthenticatedUser) {
		return this.earnings.ledger(user.id);
	}

	@Get("payout-accounts")
	@ApiOperation({ summary: "The instructor's payout accounts (default first)" })
	async payoutAccounts(@CurrentUser() user: AuthenticatedUser) {
		return { accounts: await this.payoutAccount.listAccounts(user.id) };
	}

	@Get("banks")
	@ApiOperation({ summary: "Banks for the Paystack payout-account picker" })
	async banks() {
		return { banks: await this.payoutAccount.listBanks() };
	}

	@Post("payout-accounts/paystack")
	@ApiOperation({ summary: "Verify + add a Paystack bank account" })
	addPaystack(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: SetPaystackAccountDto,
	) {
		return this.payoutAccount.addPaystackAccount(user.id, dto);
	}

	@Post("payout-accounts/:id/default")
	@ApiOperation({ summary: "Choose which account receives payouts" })
	async setDefault(
		@Param("id") id: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return { accounts: await this.payoutAccount.setDefault(user.id, id) };
	}

	@Delete("payout-accounts/:id")
	@ApiOperation({ summary: "Remove a payout account" })
	async removeAccount(
		@Param("id") id: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return { accounts: await this.payoutAccount.deleteAccount(user.id, id) };
	}

	@Post("payout-accounts/stripe/connect")
	@ApiOperation({ summary: "Start Stripe Connect onboarding" })
	async startStripeConnect(@CurrentUser() user: AuthenticatedUser) {
		const base = process.env.FRONTEND_URL ?? "http://localhost:5173";
		return this.payoutAccount.startStripeConnect(
			user.id,
			`${base}/instructor/earnings`,
			`${base}/instructor/earnings?connect=done`,
		);
	}
}
