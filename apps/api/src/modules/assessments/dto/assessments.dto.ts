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

export const ASSESSMENT_SCOPES = [
	"lesson_pre",
	"lesson_post",
	"module",
	"course_final",
	"path_final",
	"cohort",
] as const;
const ASSESSMENT_TYPES = ["quiz", "assignment", "peer_review"] as const;
const GRADING_TYPES = ["auto", "manual", "ai_assisted", "peer"] as const;
const QUESTION_TYPES = ["mcq", "true_false", "short_answer"] as const;

export type AssessmentScopeDto = (typeof ASSESSMENT_SCOPES)[number];

export class CreateAssessmentDto {
	@ApiProperty({ enum: ASSESSMENT_SCOPES })
	@IsIn(ASSESSMENT_SCOPES)
	scope!: AssessmentScopeDto;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;

	@ApiPropertyOptional({ enum: ASSESSMENT_TYPES, default: "quiz" })
	@IsOptional()
	@IsIn(ASSESSMENT_TYPES)
	type?: (typeof ASSESSMENT_TYPES)[number];

	// The parent the assessment attaches to — exactly one matching the scope.
	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	lessonId?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsUUID()
	moduleId?: string;

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

export class UpdateAssessmentDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;

	@ApiPropertyOptional({ description: "Pass mark % (default 70)." })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	passMark?: number;

	@ApiPropertyOptional({
		description: "Time limit in minutes (omit for none).",
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(600)
	timeLimitMinutes?: number;

	@ApiPropertyOptional({ description: "Max retakes (omit for unlimited)." })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(100)
	maxRetakes?: number;

	@ApiPropertyOptional({ description: "Cooldown hours between retakes." })
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(720)
	retakeCooldownHours?: number;

	@ApiPropertyOptional({
		description:
			"If set and larger than the question count, questions are sampled per attempt.",
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(500)
	questionPoolSize?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	shuffleQuestions?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	shuffleAnswers?: boolean;

	@ApiPropertyOptional({
		description: "Tab switches before auto-submit (default 3).",
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(20)
	anticheatTabSwitchLimit?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	anticheatFullscreenRequired?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	anticheatCameraRequired?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	anticheatCopyPasteBlocked?: boolean;

	@ApiPropertyOptional({
		description: "Flag answers faster than N seconds (default 2).",
	})
	@IsOptional()
	@IsInt()
	@Min(0)
	@Max(120)
	anticheatTimePerQuestionFlagSeconds?: number;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	scheduledAt?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsDateString()
	dueAt?: string;

	@ApiPropertyOptional({ enum: GRADING_TYPES })
	@IsOptional()
	@IsIn(GRADING_TYPES)
	gradingType?: (typeof GRADING_TYPES)[number];
}

export class CreateQuestionDto {
	@ApiProperty({ enum: QUESTION_TYPES })
	@IsIn(QUESTION_TYPES)
	type!: (typeof QUESTION_TYPES)[number];

	@ApiProperty()
	@IsString()
	@MinLength(1)
	@MaxLength(5000)
	body!: string;

	@ApiPropertyOptional({ type: [String], description: "Options for MCQ." })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@MaxLength(500, { each: true })
	options?: string[];

	@ApiPropertyOptional({
		description:
			"Correct answer: the option text (MCQ), 'true'/'false', or the expected text (short answer).",
	})
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	correctAnswer?: string;

	@ApiPropertyOptional({ default: 1 })
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	points?: number;
}

export class UpdateQuestionDto {
	@ApiPropertyOptional({ enum: QUESTION_TYPES })
	@IsOptional()
	@IsIn(QUESTION_TYPES)
	type?: (typeof QUESTION_TYPES)[number];

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(5000)
	body?: string;

	@ApiPropertyOptional({ type: [String] })
	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	@MaxLength(500, { each: true })
	options?: string[];

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	correctAnswer?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(100)
	points?: number;
}

export class ReorderQuestionsDto {
	@ApiProperty({ type: [String], description: "Question IDs in the new order" })
	@IsArray()
	@ArrayNotEmpty()
	@IsUUID("4", { each: true })
	questionIds!: string[];
}

export class GenerateQuestionsDto {
	@ApiPropertyOptional({
		description:
			"Source lesson whose transcript seeds the questions. Defaults to the assessment's own lesson when it is lesson-scoped.",
	})
	@IsOptional()
	@IsUUID()
	lessonId?: string;

	@ApiPropertyOptional({
		default: 5,
		description: "How many questions to generate.",
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(20)
	count?: number;

	@ApiPropertyOptional({ enum: QUESTION_TYPES, isArray: true })
	@IsOptional()
	@IsArray()
	@IsIn(QUESTION_TYPES, { each: true })
	types?: (typeof QUESTION_TYPES)[number][];
}
