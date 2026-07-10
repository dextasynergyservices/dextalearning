import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

/** The 6-digit code the learner received over WhatsApp/SMS. */
export class VerifyCodeDto {
	@ApiProperty({ example: "123456" })
	@IsString()
	@Matches(/^[0-9]{6}$/, { message: "Enter the 6-digit code." })
	code!: string;
}
