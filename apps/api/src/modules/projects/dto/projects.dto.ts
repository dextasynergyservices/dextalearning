import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
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
	ValidateNested,
} from "class-validator";

export const PROJECT_SCOPES = ["course", "path", "cohort"] as const;
export const SUBMISSION_TYPES = [
	"file_upload",
	"text_submission",
	"url_submission",
	"peer_review",
] as const;
const GRADING_TYPES = ["manual", "peer_review", "ai_assisted"] as const;

export type ProjectScopeDto = (typeof PROJECT_SCOPES)[number];

export class RubricCriterionDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(40)
	id?: string;

	@ApiProperty()
	@IsString()
	@MinLength(1)
	@MaxLength(200)
	label!: string;

	@ApiProperty()
	@IsInt()
	@Min(1)
	@Max(1000)
	maxPoints!: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(500)
	description?: string;
}

export class CreateProjectDto {
	@ApiProperty({ enum: PROJECT_SCOPES })
	@IsIn(PROJECT_SCOPES)
	scope!: ProjectScopeDto;

	@ApiProperty()
	@IsString()
	@MinLength(1)
	@MaxLength(200)
	title!: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	courseId?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	pathId?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	cohortId?: string;
}

export class UpdateProjectDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	description?: string;

	@ApiPropertyOptional({ enum: SUBMISSION_TYPES, isArray: true })
	@IsOptional()
	@IsArray()
	@IsIn(SUBMISSION_TYPES, { each: true })
	submissionTypes?: (typeof SUBMISSION_TYPES)[number][];

	@ApiPropertyOptional({
		type: [String],
		description: "Allowed file extensions (e.g. pdf, zip).",
	})
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@MaxLength(10, { each: true })
	allowedFileTypes?: string[];

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(500)
	maxFileSizeMb?: number;

	@ApiPropertyOptional({ description: "Pass mark % of rubric (default 70)." })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	passMark?: number;

	@ApiPropertyOptional({ enum: GRADING_TYPES })
	@IsOptional()
	@IsIn(GRADING_TYPES)
	gradingType?: (typeof GRADING_TYPES)[number];

	@ApiPropertyOptional({ description: "Peer reviews required per submission." })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(10)
	peerReviewCount?: number;

	// ── Retry policy (§4.5) ──────────────────────────────────────────────────
	@ApiPropertyOptional({
		description: "Total attempts allowed per window. Omit for unlimited.",
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	maxAttempts?: number;

	@ApiPropertyOptional({
		description: "Minimum hours between attempts after a graded failure.",
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(720)
	retryCooldownHours?: number;

	@ApiPropertyOptional({
		description:
			"Days locked out after using every attempt without passing; once elapsed the attempt allowance resets. Omit for no reset.",
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(365)
	retryLockoutDays?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	dueAt?: string;

	@ApiPropertyOptional({ type: [RubricCriterionDto] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(20)
	@ValidateNested({ each: true })
	@Type(() => RubricCriterionDto)
	rubric?: RubricCriterionDto[];
}
