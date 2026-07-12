import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import { EngagementQueryService } from "../engagement/engagement-query.service";
import {
	computePacing,
	type PacingSignal,
	WEEKLY_HOURS_TARGET,
} from "./pacing.calculator";

const WEEK_MS = 7 * 86_400_000;

/**
 * Adaptive Pacing (§4.10) — a per-user rhythm signal the lesson player shows
 * right after a completion. Owns no tables: reads the learner's weekly goal
 * (their own profile) + this week's activity from Engagement's exported query,
 * then runs the pure calculator (§6.4).
 */
@Injectable()
export class PacingService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly engagementQuery: EngagementQueryService,
	) {}

	async signalFor(
		user: AuthenticatedUser,
		now: Date = new Date(),
	): Promise<PacingSignal> {
		const since = new Date(now.getTime() - WEEK_MS);
		const [profile, activity] = await Promise.all([
			this.prisma.user.findUnique({
				where: { id: user.id },
				select: { weeklyHours: true },
			}),
			this.engagementQuery.weeklyActivityFor(user.id, since),
		]);

		const targetPerWeek =
			profile?.weeklyHours != null
				? (WEEKLY_HOURS_TARGET[profile.weeklyHours] ?? null)
				: null;

		return computePacing({
			lessonsThisWeek: activity.lessonsCompleted,
			targetPerWeek,
			quizzesPassed: activity.quizzesPassed,
			quizzesTotal: activity.quizzesPassed + activity.quizzesFailed,
		});
	}
}
