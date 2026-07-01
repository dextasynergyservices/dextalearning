import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, Max, Min } from "class-validator";

/**
 * Consumption signal from the lesson player. Completion is decided server-side
 * by the §4.3 rules — the client never asserts "complete" directly.
 */
export class LessonProgressDto {
	@ApiPropertyOptional({
		description: "Furthest-watched/listened percent (0–100) for video/audio.",
		minimum: 0,
		maximum: 100,
	})
	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(100)
	videoWatchedPct?: number;

	@ApiPropertyOptional({
		description: "True once a text/PDF lesson has been scrolled to the end.",
	})
	@IsOptional()
	@IsBoolean()
	scrolledToEnd?: boolean;
}
