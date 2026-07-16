import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class SetEarnBackDeadlineDto {
	@ApiProperty({
		description:
			"Days from payment to finish in. Must be at or inside the window frozen at purchase — the service rejects anything larger (§4.11.1).",
		minimum: 1,
	})
	@IsInt()
	@Min(1)
	days!: number;
}
