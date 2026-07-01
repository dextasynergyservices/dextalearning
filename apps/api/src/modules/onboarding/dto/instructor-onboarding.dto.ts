import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";

/** Instructor profile captured during onboarding (§8.1.1). All optional. */
export class InstructorOnboardingDto {
	@ApiPropertyOptional({ description: "Short professional headline" })
	@IsOptional()
	@IsString()
	@MaxLength(160)
	headline?: string;

	@ApiPropertyOptional({ description: "Public instructor bio" })
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	bio?: string;

	@ApiPropertyOptional({ type: [String], description: "Areas of expertise" })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	expertiseAreas?: string[];
}
