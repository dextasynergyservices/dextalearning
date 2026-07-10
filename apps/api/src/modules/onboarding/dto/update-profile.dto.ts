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
// Pinned onboarding enums (§8.1) — must match the learner wizard's options.
const SCHEDULES = [
	"morning",
	"afternoon",
	"evening",
	"weekend",
	"flexible",
] as const;
const HOURS = ["low", "medium", "high", "max"] as const;
// Habit-stacking anchors (§3.1) — must match reminder.messages.ts STUDY_ANCHORS.
const ANCHORS = [
	"morning_routine",
	"commute",
	"lunch_break",
	"after_work",
	"before_bed",
] as const;

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

	// `@IsOptional` only skips null/undefined — an empty string "" would still
	// hit @Matches and 400. The profile form always sends a (possibly empty)
	// phone, and "" means "no/cleared phone", so skip validation when empty.
	@ApiPropertyOptional()
	@ValidateIf(
		(o) => o.phone !== undefined && o.phone !== null && o.phone !== "",
	)
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

	// ── Learning reminder settings (§3.2 implementation intentions) ──────────

	@ApiPropertyOptional({ description: "WhatsApp reminder opt-in" })
	@IsOptional()
	@IsBoolean()
	whatsappOptIn?: boolean;

	@ApiPropertyOptional({ enum: SCHEDULES })
	@IsOptional()
	@IsIn(SCHEDULES)
	studySchedule?: string;

	@ApiPropertyOptional({ enum: HOURS })
	@IsOptional()
	@IsIn(HOURS)
	weeklyHours?: string;

	@ApiPropertyOptional({
		enum: ANCHORS,
		description: "Daily habit study time is stacked on (§3.1); '' clears it",
	})
	@IsOptional()
	@IsIn([...ANCHORS, ""])
	studyAnchor?: string;

	@ApiPropertyOptional({ description: "IANA timezone, e.g. Africa/Lagos" })
	@IsOptional()
	@IsString()
	@MaxLength(50)
	timezone?: string;
}
