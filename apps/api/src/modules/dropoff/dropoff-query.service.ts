import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { RiskLevel, RiskReason } from "./dropoff.calculator";

export interface LearnerRisk {
	level: RiskLevel;
	reasons: RiskReason[];
	daysInactive: number;
}

export interface CohortRiskCounts {
	high: number;
	medium: number;
	total: number;
}

/**
 * Drop-off's thin PUBLIC interface (§6.4 rule 1) — the sanctioned way for the
 * Teaching + Facilitator contexts to read at-risk flags without touching
 * `dropoff_flags` directly. Read-only.
 */
@Injectable()
export class DropoffQueryService {
	constructor(private readonly prisma: PrismaService) {}

	/** userId → risk, for the learners flagged in a cohort (on-track = absent). */
	async flagsForCohort(cohortId: string): Promise<Map<string, LearnerRisk>> {
		const rows = await this.prisma.dropoffFlag.findMany({
			where: { cohortId },
			select: {
				userId: true,
				level: true,
				reasonsJson: true,
				daysInactive: true,
			},
		});
		return new Map(
			rows.map((r) => [
				r.userId,
				{
					level: r.level as RiskLevel,
					reasons: (r.reasonsJson as RiskReason[]) ?? [],
					daysInactive: r.daysInactive,
				},
			]),
		);
	}

	/** cohortId → {high, medium, total} at-risk counts for the given cohorts. */
	async atRiskCountsFor(
		cohortIds: string[],
	): Promise<Map<string, CohortRiskCounts>> {
		const out = new Map<string, CohortRiskCounts>();
		if (cohortIds.length === 0) return out;
		const grouped = await this.prisma.dropoffFlag.groupBy({
			by: ["cohortId", "level"],
			where: { cohortId: { in: cohortIds } },
			_count: { _all: true },
		});
		for (const g of grouped) {
			const cur = out.get(g.cohortId) ?? { high: 0, medium: 0, total: 0 };
			const n = g._count._all;
			if (g.level === "high") cur.high += n;
			if (g.level === "medium") cur.medium += n;
			cur.total += n;
			out.set(g.cohortId, cur);
		}
		return out;
	}
}
