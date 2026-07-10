import { Module } from "@nestjs/common";
import { LeaderboardController } from "./leaderboard.controller";
import { LeaderboardService } from "./leaderboard.service";

/**
 * Leaderboard bounded context (§4.9) — a cached read-model over engagement
 * signals. Depends only on the global `CachePort` + Prisma; owns no writes to
 * other contexts.
 */
@Module({
	controllers: [LeaderboardController],
	providers: [LeaderboardService],
})
export class LeaderboardModule {}
