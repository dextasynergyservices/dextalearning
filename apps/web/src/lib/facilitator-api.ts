import { apiFetch } from "./api";
import type { GroupingMode } from "./grouping-api";

export interface FacilitatedCohort {
	id: string;
	title: string;
	slug: string;
	status: string | null;
	startsAt: string | null;
	groupingMode: GroupingMode;
	learnerCount: number;
	groupCount: number;
}

/** Cohorts the signed-in user is assigned to facilitate (portal home). */
export const getMyFacilitatedCohorts = () =>
	apiFetch<FacilitatedCohort[]>("/facilitator/cohorts");

export const facilitatorKeys = {
	cohorts: ["facilitator", "cohorts"] as const,
};
