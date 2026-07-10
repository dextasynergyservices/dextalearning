import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { SendCodeDto } from "./dto/send-code.dto";
import { VerifyCodeDto } from "./dto/verify-code.dto";
import { PhoneVerificationService } from "./phone-verification.service";

/** Verify ownership of the signed-in learner's phone number (§8.6). */
@ApiTags("phone-verification")
@ApiCookieAuth("better-auth.session_token")
@Controller("phone-verification")
@UseGuards(SessionGuard)
export class PhoneVerificationController {
	constructor(private readonly service: PhoneVerificationService) {}

	@Post("send")
	@ApiOperation({ summary: "Send a verification code over WhatsApp or SMS" })
	send(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendCodeDto) {
		return this.service.sendCode(user.id, dto.channel ?? "whatsapp");
	}

	@Post("verify")
	@ApiOperation({ summary: "Confirm a verification code" })
	verify(@CurrentUser() user: AuthenticatedUser, @Body() dto: VerifyCodeDto) {
		return this.service.verifyCode(user.id, dto.code);
	}
}
