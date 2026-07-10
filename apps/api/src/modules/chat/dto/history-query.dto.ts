import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

export class HistoryQueryDto {
	@ApiPropertyOptional({ description: "Message id to page before (older)." })
	@IsOptional()
	@IsUUID()
	cursor?: string;

	@ApiPropertyOptional({ default: 30, minimum: 1, maximum: 50 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	limit?: number;
}
