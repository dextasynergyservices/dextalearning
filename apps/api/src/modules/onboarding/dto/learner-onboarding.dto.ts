import { ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsArray,
	IsBoolean,
	IsIn,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
} from "class-validator";

const LANGUAGES = ["en", "fr", "es", "pcm"] as const;

/** Learner onboarding answers (§8.1). All optional — the wizard is skippable. */
export class LearnerOnboardingDto {
	@ApiPropertyOptional({ enum: LANGUAGES })
	@IsOptional()
	@IsIn(LANGUAGES)
	language?: string;

	@ApiPropertyOptional({ type: [String], description: "Selected goal keys" })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	goals?: string[];

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(20)
	skillLevel?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(20)
	weeklyHours?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(20)
	studySchedule?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	whatsappOptIn?: boolean;

	@ApiPropertyOptional({
		description: "Phone for WhatsApp reminders (§8.1 step 6)",
	})
	@IsOptional()
	@IsString()
	@Matches(/^[+]?[0-9\s-]{7,20}$/, { message: "Invalid phone number" })
	phone?: string;
}
