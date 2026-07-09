// Client for the read-only Analytics context (blueprint §2.4 role matrix,
// §15): instructor own-content analytics + admin platform-wide overview +
// per-learner drill-downs.
import { apiFetch } from "./api";

export type AnalyticsEntityType = "course" | "path" | "cohort";

const ANALYTICS_ENTITY_TYPES: AnalyticsEntityType[] = [
	"course",
	"path",
	"cohort",
];

/** Narrows a route param to a valid analytics entity type. */
export function isAnalyticsEntityType(
	value: string,
): value is AnalyticsEntityType {
	return (ANALYTICS_ENTITY_TYPES as string[]).includes(value);
}

export interface EntityAnalyticsRow {
	id: string;
	title: string;
	status: string | null;
	/** Published (courses/paths) or open (cohorts). */
	live: boolean;
	enrolled: number;
	completed: number;
	inProgress: number;
	notStarted: number;
	/** completed / enrolled, 0–100. */
	completionRate: number;
	/** Average stored progress across ENROLLED learners (absent rows = 0). */
	avgProgressPct: number;
	lastEnrolledAt: string | null;
	/** Admin rows only. */
	instructorName?: string | null;
}

export interface AnalyticsTotals {
	items: number;
	published: number;
	enrollments: number;
	completions: number;
	inProgress: number;
	notStarted: number;
	completionRate: number;
}

export interface InstructorAnalytics {
	totals: AnalyticsTotals & {
		courses: number;
		paths: number;
		learnersReached: number;
	};
	courses: EntityAnalyticsRow[];
	paths: EntityAnalyticsRow[];
}

export interface AdminAnalytics {
	platform: {
		learners: number;
		instructors: number;
		publishedCourses: number;
		publishedPaths: number;
		openCohorts: number;
		enrollments: number;
		completions: number;
		completionRate: number;
		activeLearners7d: number;
		newLearners30d: number;
	};
	totals: AnalyticsTotals;
	courses: EntityAnalyticsRow[];
	paths: EntityAnalyticsRow[];
	cohorts: EntityAnalyticsRow[];
}

export interface EntityLearner {
	userId: string;
	name: string;
	enrolledAt: string;
	progressPercent: number;
	isComplete: boolean;
	completedAt: string | null;
}

export interface EntityLearners {
	entity: { id: string; title: string; type: AnalyticsEntityType };
	learners: EntityLearner[];
}

export interface LearnerLessonRow {
	id: string;
	title: string;
	completed: boolean;
	postQuizScore: number | null;
}

export interface LearnerAssessmentRow {
	id: string;
	title: string;
	scope: string;
	bestScore: number | null;
	passed: boolean | null;
}

export interface LearnerComponentRow {
	id: string;
	title: string;
	type: "course" | "path";
	progressPercent: number;
	isComplete: boolean;
}

export interface LearnerDetail {
	entity: { id: string; title: string; type: AnalyticsEntityType };
	learner: {
		userId: string;
		name: string;
		email: string;
		progressPercent: number;
		isComplete: boolean;
		completedAt: string | null;
	};
	/** Course drill-down. */
	lessons?: LearnerLessonRow[];
	assessments?: LearnerAssessmentRow[];
	/** Path/cohort drill-down. */
	components?: LearnerComponentRow[];
}

export const analyticsKeys = {
	instructor: ["analytics", "instructor"] as const,
	admin: ["analytics", "admin"] as const,
	learners: (type: AnalyticsEntityType, id: string) =>
		["analytics", "learners", type, id] as const,
	learnerDetail: (type: AnalyticsEntityType, id: string, userId: string) =>
		["analytics", "learner-detail", type, id, userId] as const,
};

export function getInstructorAnalytics(): Promise<InstructorAnalytics> {
	return apiFetch<InstructorAnalytics>("/analytics/instructor");
}

export function getAdminAnalytics(): Promise<AdminAnalytics> {
	return apiFetch<AdminAnalytics>("/analytics/admin");
}

/** WHO is enrolled + how far each learner has come (ownership-scoped). */
export function getEntityLearners(
	type: AnalyticsEntityType,
	id: string,
): Promise<EntityLearners> {
	return apiFetch<EntityLearners>(`/analytics/${type}/${id}/learners`);
}

/** One learner's performance inside one course/path/cohort. */
export function getLearnerDetail(
	type: AnalyticsEntityType,
	id: string,
	userId: string,
): Promise<LearnerDetail> {
	return apiFetch<LearnerDetail>(`/analytics/${type}/${id}/learners/${userId}`);
}
