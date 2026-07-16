import {
	Body,
	Controller,
	Get,
	HttpCode,
	Param,
	Post,
	Query,
	Req,
	UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { UserThrottlerGuard } from "../../common/guards/user-throttler.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformSettingsService } from "../../shared/settings/platform-settings.service";
import { EnrollmentService } from "../enrollment/enrollment.service";
import { CheckoutDto } from "./dto/checkout.dto";
import { SetEarnBackDeadlineDto } from "./dto/earn-back-deadline.dto";
import { EarnBackDeadlineService } from "./earn-back-deadline.service";
import { PaymentGatewayRegistry } from "./payment-gateway.registry";
import { PaymentsService } from "./payments.service";

/**
 * Payments HTTP surface (§14). Learner-facing checkout is session-guarded and
 * rate-limited (§5.9: 10/min/user on payment endpoints). Provider webhooks are
 * PUBLIC (the gateway calls them) but authenticated by signature over the raw
 * body — never by session — so they carry no guard.
 */
@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
	constructor(
		private readonly payments: PaymentsService,
		private readonly enrollment: EnrollmentService,
		private readonly prisma: PrismaService,
		private readonly settings: PlatformSettingsService,
		private readonly gateways: PaymentGatewayRegistry,
		private readonly deadlines: EarnBackDeadlineService,
	) {}

	@Get("platform-fee")
	@ApiOperation({
		summary: "Public settlement terms — platform fee % + instructor share (§2)",
		description:
			"`pct` is the non-refundable platform fee. `instructorSharePct` is the creator's cut of settled revenue, which the authoring UI needs to show a creator what they actually keep at each Earn-Back percentage.",
	})
	async platformFee() {
		const [pct, instructorSharePct] = await Promise.all([
			this.settings.platformFeePct(),
			this.settings.instructorRevenueSharePct(),
		]);
		return { pct, instructorSharePct };
	}

	@Get("earn-back-window")
	@ApiOperation({
		summary: "The platform's Earn-Back window ceiling in days (§4.11.3)",
		description:
			"The most a deadline can ever be. The checkout disclosure needs it to say 'up to N days' when a creator left the window for the learner to choose.",
	})
	async earnBackWindow() {
		return { maxDays: await this.settings.earnBackMaxDurationDays() };
	}

	@Get("methods")
	@ApiOperation({
		summary: "Payment methods Admin currently offers at checkout (§14.1)",
		description:
			"Pass `currency` to also get the provider the server would pick, so the picker can preselect it without re-implementing currency routing.",
	})
	async methods(@Query("currency") currency?: string) {
		const providers = await this.settings.enabledPaymentProviders();
		return {
			providers,
			recommended: currency
				? await this.gateways.resolveProvider(currency)
				: null,
		};
	}

	@Post("checkout/:type/:id")
	@ApiCookieAuth("better-auth.session_token")
	@ApiOperation({ summary: "Start a hosted checkout for a paid entity" })
	@UseGuards(SessionGuard, UserThrottlerGuard)
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	checkout(
		@Param("type") type: string,
		@Param("id") id: string,
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: CheckoutDto,
	) {
		return this.payments.initCheckout(
			user,
			this.enrollment.parseType(type),
			id,
			dto?.provider,
		);
	}

	@Post("verify/:reference")
	@ApiCookieAuth("better-auth.session_token")
	@ApiOperation({ summary: "Verify + settle a payment on the callback page" })
	@UseGuards(SessionGuard)
	verify(
		@Param("reference") reference: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.payments.verifyAndSettle(user.id, reference);
	}

	@Get("order/:orderId/status")
	@ApiCookieAuth("better-auth.session_token")
	@ApiOperation({
		summary: "Poll an order's settlement status (callback page)",
	})
	@UseGuards(SessionGuard)
	async orderStatus(
		@Param("orderId") orderId: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		const order = await this.prisma.order.findFirst({
			where: { id: orderId, userId: user.id },
			select: {
				status: true,
				entityType: true,
				entityId: true,
				entityTitle: true,
			},
		});
		return { order };
	}

	@Get("earn-back/:type/:id")
	@ApiCookieAuth("better-auth.session_token")
	@ApiOperation({ summary: "The learner's earn-back status for an entity" })
	@UseGuards(SessionGuard)
	earnBackStatus(
		@Param("type") type: string,
		@Param("id") id: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.payments.earnBackStatus(
			user.id,
			this.enrollment.parseType(type),
			id,
		);
	}

	@Post("earn-back/:type/:id/deadline")
	@ApiCookieAuth("better-auth.session_token")
	@ApiOperation({
		summary: "Commit to a personal Earn-Back deadline (§4.11.1)",
		description:
			"Only when the creator left the window open, only once, and only for a value at or inside the window frozen at purchase. The clock runs from payment.",
	})
	@UseGuards(SessionGuard, UserThrottlerGuard)
	@Throttle({ default: { limit: 10, ttl: 60_000 } })
	setEarnBackDeadline(
		@Param("type") type: string,
		@Param("id") id: string,
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: SetEarnBackDeadlineDto,
	) {
		return this.deadlines.setDeadline(
			user.id,
			this.enrollment.parseType(type),
			id,
			dto.days,
		);
	}

	@Post("webhook/paystack")
	@HttpCode(200)
	@ApiOperation({ summary: "Paystack webhook (signature-authenticated)" })
	paystackWebhook(@Req() req: Request & { rawBody?: Buffer }) {
		return this.payments.handleWebhook(
			"paystack",
			req.rawBody ?? Buffer.from(""),
			req.headers["x-paystack-signature"] as string | undefined,
		);
	}

	@Post("webhook/stripe")
	@HttpCode(200)
	@ApiOperation({ summary: "Stripe webhook (signature-authenticated)" })
	stripeWebhook(@Req() req: Request & { rawBody?: Buffer }) {
		return this.payments.handleWebhook(
			"stripe",
			req.rawBody ?? Buffer.from(""),
			req.headers["stripe-signature"] as string | undefined,
		);
	}
}
