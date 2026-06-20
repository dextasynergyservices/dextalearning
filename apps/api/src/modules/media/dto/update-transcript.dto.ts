import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class UpdateTranscriptDto {
	@ApiProperty({
		description: "Full lesson transcript text (required to publish)",
	})
	@IsString()
	@IsNotEmpty()
	@MaxLength(100_000)
	text!: string;
}
