import { Module } from "@nestjs/common";
import { PhoneVerificationController } from "./phone-verification.controller";
import { PhoneVerificationService } from "./phone-verification.service";

/**
 * Phone-verification bounded context — issues and checks WhatsApp/SMS OTP
 * codes. Depends only on the global `NotificationPort` (§6.4); owns the
 * `phone_verifications` table.
 */
@Module({
	controllers: [PhoneVerificationController],
	providers: [PhoneVerificationService],
})
export class PhoneVerificationModule {}
