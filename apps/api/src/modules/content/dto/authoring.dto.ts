import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayNotEmpty,
	IsArray,
	IsBoolean,
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
import { SanitizeRichText } from "../../../common/sanitize/rich-text.sanitizer";

const LEVELS = ["beginner", "intermediate", "advanced"] as const;
const LANGS = ["en", "fr", "es", "pcm"] as const;
const CONTENT_TYPES = ["video", "text", "pdf", "audio", "code"] as const;

/** Languages a code lesson can target (§9 Tech Academy). JS/TS run in-browser;
 *  the rest are editor-only for now (see the free-tier execution decision). */
export const CODE_LANGUAGES = [
	"javascript",
	"typescript",
	"python",
	"html",
	"css",
	"sql",
	"json",
	"java",
	"cpp",
	"go",
	"rust",
	"shell",
] as const;

/** Config for a `code` lesson — stored on `Lesson.codeConfigJson`. */
export class CodeConfigDto {
	@ApiProperty({ enum: CODE_LANGUAGES })
	@IsIn(CODE_LANGUAGES)
	language!: (typeof CODE_LANGUAGES)[number];

	@ApiProperty({ description: "The exercise brief shown above the editor." })
	@IsString()
	@MaxLength(20_000)
	instructions!: string;

	@ApiProperty({ description: "Initial editor contents." })
	@IsString()
	@MaxLength(50_000)
	starterCode!: string;
}
const CURRENCIES = ["NGN", "USD", "GHS", "KES", "ZAR", "GBP", "EUR"] as const;

export class CreateCourseDto {
	@ApiProperty()
	@IsString()
	@MinLength(3)
	@MaxLength(200)
	title!: string;

	@ApiPropertyOptional({
		description:
			"Academy (tenant) slug this course belongs to. Default: teachers.",
	})
	@IsOptional()
	@IsString()
	academy?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	@SanitizeRichText()
	description?: string;

	@ApiPropertyOptional({ enum: LEVELS })
	@IsOptional()
	@IsIn(LEVELS)
	level?: (typeof LEVELS)[number];

	@ApiPropertyOptional({ enum: LANGS })
	@IsOptional()
	@IsIn(LANGS)
	language?: (typeof LANGS)[number];

	@ApiPropertyOptional({
		description: "Price in the chosen currency (e.g. 5000)",
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100_000_000)
	price?: number;

	@ApiPropertyOptional({
		description: "Free courses carry no price or Earn-Back.",
	})
	@IsOptional()
	@IsBoolean()
	isFree?: boolean;

	@ApiPropertyOptional({ enum: CURRENCIES })
	@IsOptional()
	@IsIn(CURRENCIES)
	currency?: (typeof CURRENCIES)[number];

	@ApiPropertyOptional({
		description: "Whether the course offers Earn-Back (§4.11).",
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

	@ApiPropertyOptional({
		description: "Days the learner has to earn the refund back.",
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(365)
	earnBackDeadlineDays?: number;
}

export class UpdateCourseDto {
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
	@SanitizeRichText()
	description?: string;

	@ApiPropertyOptional({ enum: LEVELS })
	@IsOptional()
	@IsIn(LEVELS)
	level?: (typeof LEVELS)[number];

	@ApiPropertyOptional({
		description: 'Free-text duration, e.g. "6–8 weeks (self-paced)".',
	})
	@IsOptional()
	@IsString()
	@MaxLength(120)
	estimatedDuration?: string;

	@ApiPropertyOptional({ enum: LANGS })
	@IsOptional()
	@IsIn(LANGS)
	language?: (typeof LANGS)[number];

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	hasFinalAssessment?: boolean;

	@ApiPropertyOptional({ description: "Feature on the homepage (admin only)." })
	@IsOptional()
	@IsBoolean()
	isFeatured?: boolean;

	@ApiPropertyOptional({
		description: "Instructor request to be featured (admin then approves).",
	})
	@IsOptional()
	@IsBoolean()
	featureRequested?: boolean;

	@ApiPropertyOptional({
		description: "Price in the chosen currency (e.g. 5000)",
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100_000_000)
	price?: number;

	@ApiPropertyOptional({
		description: "Free courses carry no price or Earn-Back.",
	})
	@IsOptional()
	@IsBoolean()
	isFree?: boolean;

	@ApiPropertyOptional({ enum: CURRENCIES })
	@IsOptional()
	@IsIn(CURRENCIES)
	currency?: (typeof CURRENCIES)[number];

	@ApiPropertyOptional({
		description: "Whether the course offers Earn-Back (§4.11).",
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

	@ApiPropertyOptional({
		description: "Days the learner has to earn the refund back.",
	})
	@IsOptional()
	@IsInt()
	@Min(1)
	@Max(365)
	earnBackDeadlineDays?: number;
}

export class CreateModuleDto {
	@ApiProperty()
	@IsString()
	@MinLength(1)
	@MaxLength(200)
	title!: string;
}

export class CreateLessonDto {
	@ApiProperty()
	@IsString()
	@MinLength(1)
	@MaxLength(200)
	title!: string;

	@ApiPropertyOptional({ enum: CONTENT_TYPES })
	@IsOptional()
	@IsIn(CONTENT_TYPES)
	contentType?: (typeof CONTENT_TYPES)[number];
}

export class UpdateLessonDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(200)
	title?: string;

	@ApiPropertyOptional({ enum: CONTENT_TYPES })
	@IsOptional()
	@IsIn(CONTENT_TYPES)
	contentType?: (typeof CONTENT_TYPES)[number];

	@ApiPropertyOptional({ description: "Rich-text HTML for `text` lessons" })
	@IsOptional()
	@IsString()
	@MaxLength(200_000)
	@SanitizeRichText()
	contentText?: string;

	@ApiPropertyOptional({
		type: CodeConfigDto,
		description: "For `code` lessons",
	})
	@IsOptional()
	@ValidateNested()
	@Type(() => CodeConfigDto)
	codeConfigJson?: CodeConfigDto;

	@ApiPropertyOptional()
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	minVideoWatchPct?: number;

	@ApiPropertyOptional({
		description: "Free preview lesson — viewable publicly before enrolling.",
	})
	@IsOptional()
	@IsBoolean()
	isPreview?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	hasPreQuiz?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsBoolean()
	hasPostQuiz?: boolean;

	@ApiPropertyOptional()
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	postQuizPassMark?: number;
}

export class ReorderDto {
	@ApiProperty()
	@IsInt()
	@Min(1)
	orderIndex!: number;
}

export class ReorderLessonsDto {
	@ApiProperty({ type: [String], description: "Lesson IDs in the new order" })
	@IsArray()
	@ArrayNotEmpty()
	@IsUUID("4", { each: true })
	lessonIds!: string[];
}
