import type { AssessmentScope } from "../../../generated/prisma/client";

/**
 * The **summative** assessment scopes — the end-of-course/path/cohort finals.
 *
 * Only these carry a retry policy (§4.4.1). Lesson and module quizzes are
 * formative: they're practice, they gate nothing, and capping attempts on them
 * would only punish a learner for rehearsing. A final is the opposite — it
 * gates completion, the certificate and Earn-Back — so that's where attempt
 * limits, waits and lockouts belong, mirroring the final project (§4.5).
 */
export const FINAL_ASSESSMENT_SCOPES: readonly AssessmentScope[] = [
	"course_final",
	"path_final",
	"cohort",
];

export function isFinalAssessmentScope(
	scope: AssessmentScope | null | undefined,
): boolean {
	return !!scope && FINAL_ASSESSMENT_SCOPES.includes(scope);
}
