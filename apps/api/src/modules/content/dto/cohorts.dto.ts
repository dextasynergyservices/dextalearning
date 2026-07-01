import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
	IsDateString,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	MinLength,
} from "class-validator";

const CURRENCIES = ["NGN", "USD", "GHS", "KES", "ZAR", "GBP", "EUR"] as const;
const EXAM_MODES = [
	"unified",
	"rolling",
	"instructor",
	"deadline_bound",
] as const;
const UNLOCK_MODES = ["all_at_once", "progressive", "scheduled"] as const;
const GROUPING_MODES = [
	"randomized",
	"skill_based",
	"balanced",
	"manual",
] as const;

export class CreateCohortDto {
	@ApiProperty()
	@IsString()
	@MinLength(3)
	@MaxLength(200)
	title!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	description?: string;
}

export class UpdateCohortDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MinLength(3)
	@MaxLength(200)
	title?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	description?: string;

	@ApiPropertyOptional({ description: "ISO date the cohort starts." })
	@IsOptional()
	@IsDateString()
	startsAt?: string;

	@ApiPropertyOptional({ description: "ISO date the cohort ends." })
	@IsOptional()
	@IsDateString()
	endsAt?: string;

	@ApiPropertyOptional({ description: "Maximum seats (omit for unlimited)." })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100_000)
	capacity?: number;

	@ApiPropertyOptional({
		description: "Price in the chosen currency (e.g. 5000)",
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100_000_000)
	price?: number;

	@ApiPropertyOptional({
		description: "Free cohorts carry no price or Earn-Back.",
	})
	@IsOptional()
	@IsBoolean()
	isFree?: boolean;

	@ApiPropertyOptional({ enum: CURRENCIES })
	@IsOptional()
	@IsIn(CURRENCIES)
	currency?: (typeof CURRENCIES)[number];

	@ApiPropertyOptional({
		description: "Whether the cohort offers Earn-Back (§4.11).",
	})
	@IsOptional()
	@IsBoolean()
	isEarnBackEligible?: boolean;

	@ApiPropertyOptional({
		description:
			"1–100; the % of price held as the refundable Earn-Back base. Default 100 when on.",
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	earnBackPercentage?: number;

	@ApiPropertyOptional({ description: "Feature on the homepage." })
	@IsOptional()
	@IsBoolean()
	isFeatured?: boolean;

	@ApiPropertyOptional({ enum: EXAM_MODES })
	@IsOptional()
	@IsIn(EXAM_MODES)
	examMode?: (typeof EXAM_MODES)[number];

	@ApiPropertyOptional({ enum: UNLOCK_MODES })
	@IsOptional()
	@IsIn(UNLOCK_MODES)
	unlockMode?: (typeof UNLOCK_MODES)[number];

	@ApiPropertyOptional({ enum: GROUPING_MODES })
	@IsOptional()
	@IsIn(GROUPING_MODES)
	groupingMode?: (typeof GROUPING_MODES)[number];

	@ApiPropertyOptional({ description: "Target group size (default 5)." })
	@IsOptional()
	@IsInt()
	@Min(2)
	@Max(50)
	targetGroupSize?: number;

	@ApiPropertyOptional({ description: "Minimum group size (default 3)." })
	@IsOptional()
	@IsInt()
	@Min(2)
	@Max(50)
	minGroupSize?: number;

	@ApiPropertyOptional({ description: "Maximum group size (default 8)." })
	@IsOptional()
	@IsInt()
	@Min(2)
	@Max(50)
	maxGroupSize?: number;
}

export class AddCohortCourseDto {
	@ApiProperty({ description: "Course to add to the cohort." })
	@IsUUID()
	courseId!: string;
}

export class AddCohortPathDto {
	@ApiProperty({ description: "Learning path to add to the cohort." })
	@IsUUID()
	pathId!: string;
}

export class ReorderCohortCoursesDto {
	@ApiProperty({ type: [String], description: "Course IDs in the new order" })
	@IsArray()
	@ArrayNotEmpty()
	@IsUUID("4", { each: true })
	courseIds!: string[];
}

export class AssignUserDto {
	@ApiProperty({ description: "User to assign (instructor or facilitator)." })
	@IsUUID()
	userId!: string;
}
