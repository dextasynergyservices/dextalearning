import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";

class SubmissionFileDto {
	@IsString()
	@MaxLength(500)
	key!: string;

	@IsString()
	@MaxLength(300)
	name!: string;
}

export class SubmitProjectDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(20000)
	textContent?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	urlSubmission?: string;

	@ApiPropertyOptional({ type: [SubmissionFileDto] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(20)
	@ValidateNested({ each: true })
	@Type(() => SubmissionFileDto)
	files?: SubmissionFileDto[];
}

class RubricScoreDto {
	@IsString()
	@MaxLength(40)
	criterionId!: string;

	@IsNumber()
	@Min(0)
	points!: number;
}

export class GradeSubmissionDto {
	@ApiPropertyOptional({ type: [RubricScoreDto] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(30)
	@ValidateNested({ each: true })
	@Type(() => RubricScoreDto)
	rubricScores?: RubricScoreDto[];

	@ApiPropertyOptional({
		description: "Explicit score % (overrides rubric total).",
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	score?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	passed?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	feedback?: string;
}

export class SubmitPeerReviewDto {
	@ApiPropertyOptional({ type: [RubricScoreDto] })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(30)
	@ValidateNested({ each: true })
	@Type(() => RubricScoreDto)
	rubricScores?: RubricScoreDto[];

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	feedback?: string;
}
