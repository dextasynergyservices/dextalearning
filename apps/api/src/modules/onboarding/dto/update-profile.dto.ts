import { ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsArray,
	IsIn,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
} from "class-validator";

const LANGUAGES = ["en", "fr", "es", "pcm"] as const;

/** Full profile edit (Studio + learner profile) — everything except email. */
export class UpdateProfileDto {
	@ApiPropertyOptional({ enum: LANGUAGES })
	@IsOptional()
	@IsIn(LANGUAGES)
	language?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(100)
	firstName?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(100)
	lastName?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(100)
	otherNames?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@Matches(/^[+]?[0-9\s-]{7,20}$/, { message: "Invalid phone number" })
	phone?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(160)
	headline?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	bio?: string;

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	expertiseAreas?: string[];
}
