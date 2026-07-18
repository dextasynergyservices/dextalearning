import { apiFetch } from "./api";

/**
 * Time-series analytics client (§15). All read-only; buckets are UTC days /
 * months (the charts say so in their subtitles).
 */

export interface EnrolmentTrendPoint {
	/** UTC day, YYYY-MM-DD. */
	date: string;
	courses: number;
	paths: number;
	cohorts: number;
}

/** Monthly earnings split per §8.5.1: booked when the money became theirs. */
export interface EarningsTrendPoint {
	/** UTC month, YYYY-MM. */
	month: string;
	guaranteed: number;
	fromEscrow: number;
}

export interface FunnelStage {
	key: "enrolled" | "started" | "completed";
	count: number;
}

/** Monthly platform money, §14.1.1 definitions (admin-only). */
export interface PlatformRevenueTrendPoint {
	/** UTC month, YYYY-MM. */
	month: string;
	gross: number;
	platformTake: number;
	instructorEarnings: number;
}

export interface AntiCheatSummary {
	attempts: number;
	flagged: number;
	/** cameraMonitored = false — nobody was watching (§4.6.2.1). */
	unmonitored: number;
	escalated: number;
	invalidated: number;
	eventCounts: { eventType: string; count: number }[];
}

export interface OutcomeDistribution {
	notStarted: number;
	inProgress: number;
	completed: number;
}

export interface EarnBackOutcomes {
	onTime: number;
	late: number;
	missed: number;
}

export interface HeatmapCell {
	/** 0 = Sunday … 6 = Saturday (UTC). */
	dow: number;
	hour: number;
	count: number;
}

export interface RevenueByType {
	entityType: "course" | "path" | "cohort";
	gross: number;
}

export interface LearnerGrowthPoint {
	/** UTC month, YYYY-MM. */
	month: string;
	total: number;
}

export const trendKeys = {
	enrolments: (days: number) => ["analytics", "enrolment-trend", days] as const,
	earnings: (months: number) =>
		["analytics", "earnings-trend", months] as const,
	funnel: (type: string, id: string) =>
		["analytics", "funnel", type, id] as const,
	revenue: (months: number) => ["analytics", "revenue-trend", months] as const,
	antiCheat: (days: number) => ["analytics", "anti-cheat", days] as const,
	outcomes: ["analytics", "outcome-distribution"] as const,
	earnBackOutcomes: ["analytics", "earn-back-outcomes"] as const,
	heatmap: (days: number) => ["analytics", "activity-heatmap", days] as const,
	revenueByType: ["analytics", "revenue-by-type"] as const,
	learnerGrowth: (months: number) =>
		["analytics", "learner-growth", months] as const,
};

export const getEnrolmentTrend = (days: number) =>
	apiFetch<EnrolmentTrendPoint[]>(
		`/analytics/instructor/enrolment-trend?days=${days}`,
	);

export const getEarningsTrend = (months: number) =>
	apiFetch<EarningsTrendPoint[]>(
		`/analytics/instructor/earnings-trend?months=${months}`,
	);

export const getCompletionFunnel = (entityType: string, id: string) =>
	apiFetch<{ title: string; stages: FunnelStage[] }>(
		`/analytics/${entityType}/${id}/funnel`,
	);

export const getPlatformRevenueTrend = (months: number) =>
	apiFetch<PlatformRevenueTrendPoint[]>(
		`/analytics/admin/revenue-trend?months=${months}`,
	);

export const getAntiCheatSummary = (days: number) =>
	apiFetch<AntiCheatSummary>(
		`/analytics/admin/anti-cheat-summary?days=${days}`,
	);

export const getOutcomeDistribution = () =>
	apiFetch<OutcomeDistribution>("/analytics/instructor/outcome-distribution");

export const getEarnBackOutcomes = () =>
	apiFetch<EarnBackOutcomes>("/analytics/instructor/earn-back-outcomes");

export const getActivityHeatmap = (days: number) =>
	apiFetch<HeatmapCell[]>(`/analytics/activity-heatmap?days=${days}`);

export const getRevenueByType = () =>
	apiFetch<RevenueByType[]>("/analytics/admin/revenue-by-type");

export const getLearnerGrowth = (months: number) =>
	apiFetch<LearnerGrowthPoint[]>(
		`/analytics/admin/learner-growth?months=${months}`,
	);
