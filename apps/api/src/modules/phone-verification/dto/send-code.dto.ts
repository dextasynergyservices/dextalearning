import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";

/** Which channel to deliver the verification code over (defaults to WhatsApp). */
export class SendCodeDto {
	@ApiPropertyOptional({ enum: ["whatsapp", "sms"], default: "whatsapp" })
	@IsOptional()
	@IsIn(["whatsapp", "sms"])
	channel?: "whatsapp" | "sms";
}
