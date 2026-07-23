import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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
} from "class-validator";
import { SanitizeRichText } from "../../../common/sanitize/rich-text.sanitizer";

const PATH_LEVELS = ["beginner", "intermediate", "advanced", "mixed"] as const;
const CURRENCIES = ["NGN", "USD", "GHS", "KES", "ZAR", "GBP", "EUR"] as const;

export class CreatePathDto {
	@ApiProperty()
	@IsString()
	@MinLength(3)
	@MaxLength(200)
	title!: string;

	@ApiPropertyOptional({ description: "Academy slug. Default: teachers." })
	@IsOptional()
	@IsString()
	academy?: string;

	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MaxLength(5000)
	@SanitizeRichText()
	description?: string;

	@ApiPropertyOptional({ enum: PATH_LEVELS })
	@IsOptional()
	@IsIn(PATH_LEVELS)
	level?: (typeof PATH_LEVELS)[number];
}

export class UpdatePathDto {
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

	@ApiPropertyOptional({ enum: PATH_LEVELS })
	@IsOptional()
	@IsIn(PATH_LEVELS)
	level?: (typeof PATH_LEVELS)[number];

	@ApiPropertyOptional({
		description: "Outcome statement shown on the path page.",
	})
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	@SanitizeRichText()
	outcomeStatement?: string;

	@ApiPropertyOptional({ description: "Estimated completion time in hours." })
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(10_000)
	estimatedHours?: number;

	@ApiPropertyOptional({
		description: 'Free-text duration, e.g. "6–8 weeks (self-paced)".',
	})
	@IsOptional()
	@IsString()
	@MaxLength(120)
	estimatedDuration?: string;

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
		description: "Free paths carry no price or Earn-Back.",
	})
	@IsOptional()
	@IsBoolean()
	isFree?: boolean;

	@ApiPropertyOptional({ enum: CURRENCIES })
	@IsOptional()
	@IsIn(CURRENCIES)
	currency?: (typeof CURRENCIES)[number];

	@ApiPropertyOptional({
		description: "Whether the path offers Earn-Back (§4.11).",
	})
	@IsOptional()
	@IsBoolean()
	isEarnBackEligible?: boolean;

	@ApiPropertyOptional({
		description:
			"1–100; the % of price held as the refundable Earn-Back base. Governs the WHOLE path purchase (§4.11). Default 100 when on.",
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

export class AddPathCourseDto {
	@ApiProperty({ description: "Course to append to the path." })
	@IsUUID()
	courseId!: string;

	@ApiPropertyOptional({
		description: "Whether the course is required (default true).",
	})
	@IsOptional()
	@IsBoolean()
	isRequired?: boolean;
}

export class ReorderPathCoursesDto {
	@ApiProperty({ type: [String], description: "Course IDs in the new order" })
	@IsArray()
	@ArrayNotEmpty()
	@IsUUID("4", { each: true })
	courseIds!: string[];
}
