import { apiFetch } from "./api";

/**
 * Platform earnings client (§2, §15). Admin-only, read-only: what the platform
 * has taken across every settled order, and which content it came from.
 */

export interface PlatformEarningsSummary {
	currency: string;
	grossVolume: number;
	platformFee: number;
	platformTake: number;
	instructorEarnings: number;
	earnBackEscrowed: number;
	earnBackRefunded: number;
	orderCount: number;
}

export interface PlatformEarningsRow {
	entityType: string | null;
	entityId: string | null;
	entityTitle: string | null;
	currency: string;
	orderCount: number;
	grossVolume: number;
	platformFee: number;
	platformTake: number;
	instructorEarnings: number;
}

export const adminEarningsKeys = {
	overview: ["admin", "earnings"] as const,
};

export const getPlatformEarnings = () =>
	apiFetch<{
		summary: PlatformEarningsSummary;
		entities: PlatformEarningsRow[];
	}>("/admin/earnings");
