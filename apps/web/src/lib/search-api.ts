import { apiFetch } from "./api";

// Semantic search over a course's lesson transcripts (§4.10 RAG). Session-based,
// like lesson playback. Results are one best-matching passage per lesson.

export interface ContentSearchResult {
	lessonId: string;
	lessonTitle: string;
	snippet: string;
}

export const searchCourseContent = (courseId: string, q: string) =>
	apiFetch<ContentSearchResult[]>(
		`/courses/${courseId}/search?q=${encodeURIComponent(q)}`,
	);

export const searchPathContent = (pathId: string, q: string) =>
	apiFetch<ContentSearchResult[]>(
		`/paths/${pathId}/search?q=${encodeURIComponent(q)}`,
	);

export const searchCohortContent = (cohortId: string, q: string) =>
	apiFetch<ContentSearchResult[]>(
		`/cohorts/${cohortId}/search?q=${encodeURIComponent(q)}`,
	);

export const searchKeys = {
	scope: (scopeId: string, q: string) =>
		["content-search", scopeId, q] as const,
};
