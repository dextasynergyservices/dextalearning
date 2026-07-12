import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsIn,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
	ValidateNested,
} from "class-validator";

export const TUTOR_ROLES = ["user", "assistant"] as const;

/** One prior turn of the tutor conversation, sent back for follow-up context. */
export class TutorTurnDto {
	@ApiProperty({ enum: TUTOR_ROLES })
	@IsIn(TUTOR_ROLES)
	role!: (typeof TUTOR_ROLES)[number];

	@ApiProperty()
	@IsString()
	@MinLength(1)
	@MaxLength(4000)
	content!: string;
}

export class AskTutorDto {
	@ApiProperty({ description: "The learner's question about the lesson." })
	@IsString()
	@MinLength(1)
	@MaxLength(1000)
	question!: string;

	@ApiPropertyOptional({
		type: [TutorTurnDto],
		description: "Prior turns (oldest first); trimmed server-side.",
	})
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(20)
	@ValidateNested({ each: true })
	@Type(() => TutorTurnDto)
	history?: TutorTurnDto[];
}
