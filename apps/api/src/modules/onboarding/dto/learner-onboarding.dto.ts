import { ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsArray,
	IsBoolean,
	IsIn,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	ValidateIf,
} from "class-validator";

const LANGUAGES = ["en", "fr", "es", "pcm"] as const;
// Habit-stacking anchors (§3.1) — must match reminder.messages.ts STUDY_ANCHORS.
const ANCHORS = [
	"morning_routine",
	"commute",
	"lunch_break",
	"after_work",
	"before_bed",
] as const;

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

	@ApiPropertyOptional({
		enum: ANCHORS,
		description: "Daily habit study time is stacked on (§3.1)",
	})
	@IsOptional()
	@IsIn(ANCHORS)
	studyAnchor?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	whatsappOptIn?: boolean;

	@ApiPropertyOptional({
		description: "Phone for WhatsApp reminders (§8.1 step 6)",
	})
	// Skip validation for an empty/absent phone (see UpdateProfileDto) — the
	// wizard's phone step is optional.
	@ValidateIf(
		(o) => o.phone !== undefined && o.phone !== null && o.phone !== "",
	)
	@IsString()
	@Matches(/^[+]?[0-9\s-]{7,20}$/, { message: "Invalid phone number" })
	phone?: string;
}
