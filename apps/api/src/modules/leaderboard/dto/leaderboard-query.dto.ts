import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { LEADERBOARD_TYPES } from "../leaderboard.calculator";

const PERIODS = ["all_time", "weekly"] as const;

export class LeaderboardQueryDto {
	@ApiPropertyOptional({ enum: LEADERBOARD_TYPES, default: "overall" })
	@IsOptional()
	@IsIn(LEADERBOARD_TYPES)
	type?: (typeof LEADERBOARD_TYPES)[number];

	@ApiPropertyOptional({ description: "Scope to a cohort's members/groups." })
	@IsOptional()
	@IsUUID()
	cohortId?: string;

	@ApiPropertyOptional({ enum: PERIODS, default: "all_time" })
	@IsOptional()
	@IsIn(PERIODS)
	period?: (typeof PERIODS)[number];

	@ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit?: number;
}
