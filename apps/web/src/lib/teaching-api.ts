import { apiFetch } from "./api";
import type { LearnerRisk } from "./risk";

// An instructor's read-only view of the cohorts they're assigned to teach
// (§Role Definitions). Assignment = subject-matter teacher for the cohort;
// it grants monitoring visibility (roster + progress), not group/settings
// management.

export interface TeachingCohort {
	id: string;
	title: string;
	slug: string;
	status: string | null;
	startsAt: string | null;
	learnerCount: number;
	courseCount: number;
	atRiskCount: number;
}

export interface TeachingLearner {
	userId: string;
	name: string;
	email: string;
	enrolledAt: string;
	progressPercent: number;
	completed: boolean;
	risk: LearnerRisk | null;
}

export interface TeachingCohortDetail {
	id: string;
	title: string;
	status: string | null;
	startsAt: string | null;
	endsAt: string | null;
	courses: { id: string; title: string }[];
	paths: { id: string; title: string }[];
	assessmentCount: number;
	projectCount: number;
	learners: TeachingLearner[];
}

export const getMyTeachingCohorts = () =>
	apiFetch<TeachingCohort[]>("/instructor/cohorts");

export const getTeachingCohortDetail = (cohortId: string) =>
	apiFetch<TeachingCohortDetail>(`/instructor/cohorts/${cohortId}`);

export const teachingKeys = {
	list: ["teaching", "cohorts"] as const,
	detail: (cohortId: string) => ["teaching", "cohort", cohortId] as const,
};
