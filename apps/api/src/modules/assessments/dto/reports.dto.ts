import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

/** Optional reviewer note for invalidate / escalate actions (§4.6.4). */
export class ReviewReasonDto {
	@ApiPropertyOptional({ description: "Reason shown in the integrity record." })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	reason?: string;
}
