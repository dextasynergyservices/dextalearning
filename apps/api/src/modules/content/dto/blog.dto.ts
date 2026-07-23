import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { SanitizeRichText } from "../../../common/sanitize/rich-text.sanitizer";

export class CreateBlogPostDto {
	@ApiProperty()
	@IsString()
	@MinLength(3)
	@MaxLength(200)
	title!: string;
}

export class UpdateBlogPostDto {
	@ApiPropertyOptional()
	@IsOptional()
	@IsString()
	@MinLength(3)
	@MaxLength(200)
	title?: string;

	@ApiPropertyOptional({ description: "Short summary shown on cards." })
	@IsOptional()
	@IsString()
	@MaxLength(500)
	excerpt?: string;

	@ApiPropertyOptional({
		description: "Category label, e.g. “Learning science”.",
	})
	@IsOptional()
	@IsString()
	@MaxLength(80)
	category?: string;

	@ApiPropertyOptional({ description: "Display author name." })
	@IsOptional()
	@IsString()
	@MaxLength(120)
	authorName?: string;

	@ApiPropertyOptional({ description: "Rich-text HTML body." })
	@IsOptional()
	@IsString()
	@MaxLength(500_000)
	@SanitizeRichText()
	bodyHtml?: string;
}
