import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Engagement's thin PUBLIC interface for other contexts (§6.4 rule 1: "each
 * context … exposes a small public service interface"). Reminders calls this
 * instead of reading `user_streaks` directly — the only sanctioned way in.
 */
@Injectable()
export class EngagementQueryService {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Streaks that could be at risk "today". Over-fetches a 2-day UTC window
	 * (timezone spread); the caller re-checks exact at-risk-ness per user in
	 * that user's own timezone.
	 */
	async listStreaksAtRisk(): Promise<
		{ userId: string; current: number; lastActiveDate: string }[]
	> {
		const windowStart = new Date(Date.now() - 3 * 86_400_000);
		const rows = await this.prisma.userStreak.findMany({
			where: { current: { gt: 0 }, lastActiveDate: { gte: windowStart } },
			select: { userId: true, current: true, lastActiveDate: true },
		});
		return rows
			.filter((r) => r.lastActiveDate != null)
			.map((r) => ({
				userId: r.userId,
				current: r.current,
				lastActiveDate: (r.lastActiveDate as Date).toISOString().slice(0, 10),
			}));
	}
}
