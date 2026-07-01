import { ApiProperty } from "@nestjs/swagger";
import {
	ArrayMaxSize,
	IsArray,
	IsIn,
	IsString,
	MaxLength,
} from "class-validator";

const LANGS = ["en", "fr", "es", "pcm"] as const;

export class TranslateDto {
	@ApiProperty({
		type: [String],
		description:
			"Display texts to translate (read-only; never used for grading).",
	})
	@IsArray()
	@ArrayMaxSize(120)
	@IsString({ each: true })
	@MaxLength(4000, { each: true })
	texts!: string[];

	@ApiProperty({ enum: LANGS })
	@IsIn(LANGS)
	language!: (typeof LANGS)[number];
}
