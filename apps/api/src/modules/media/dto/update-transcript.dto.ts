import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
	ArrayMaxSize,
	IsArray,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
	Min,
	ValidateNested,
} from "class-validator";

/** One timed transcript segment (seconds). Parsed from VTT/SRT on the client. */
export class TranscriptCueDto {
	@ApiProperty({ description: "Segment start time in seconds." })
	@IsNumber()
	@Min(0)
	start!: number;

	@ApiProperty({ description: "Segment end time in seconds." })
	@IsNumber()
	@Min(0)
	end!: number;

	@ApiProperty({ description: "Spoken text for this segment." })
	@IsString()
	@MaxLength(2_000)
	text!: string;
}

export class UpdateTranscriptDto {
	@ApiProperty({
		description: "Full lesson transcript text (required to publish)",
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(100_000)
	text!: string;

	@ApiPropertyOptional({
		description:
			"Timed segments for in-player highlight. When present, the flat text is derived from them.",
		type: [TranscriptCueDto],
	})
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(5_000)
	@ValidateNested({ each: true })
	@Type(() => TranscriptCueDto)
	cues?: TranscriptCueDto[];
}
