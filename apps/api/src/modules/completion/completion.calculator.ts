/**
 * Pure completion-percentage math (§4.3, §6.4 "pure calculators" — no Prisma,
 * no I/O). Extracted from completion.service.ts so the rules governing what
 * counts as "done" can be tested directly, without a database.
 *
 * Shared rule across all three levels: percent is the average of only the
 * gates that actually APPLY (count > 0 / required), never padded by gates
 * that don't exist — so e.g. a content-only course with no assessments reads
 * 0% before any lesson, not an inflated baseline from "passing" nothing.
 */

export interface CourseCompletionInput {
	lessonsDone: number;
	lessonsTotal: number;
	moduleAssessmentsCount: number;
	allModuleAssessmentsPassed: boolean;
	finalRequired: boolean;
	finalAssessmentPassed: boolean;
	projectsCount: number;
	allProjectsPassed: boolean;
}

export interface CourseCompletionResult {
	allLessonsDone: boolean;
	isComplete: boolean;
	percent: number;
}

export function calculateCourseCompletion(
	input: CourseCompletionInput,
): CourseCompletionResult {
	const allLessonsDone = input.lessonsDone >= input.lessonsTotal;
	const isComplete =
		allLessonsDone &&
		input.allModuleAssessmentsPassed &&
		input.finalAssessmentPassed &&
		input.allProjectsPassed;

	const gates: number[] = [];
	if (input.lessonsTotal > 0)
		gates.push(input.lessonsDone / input.lessonsTotal);
	if (input.moduleAssessmentsCount > 0) {
		gates.push(input.allModuleAssessmentsPassed ? 1 : 0);
	}
	if (input.finalRequired) gates.push(input.finalAssessmentPassed ? 1 : 0);
	if (input.projectsCount > 0) gates.push(input.allProjectsPassed ? 1 : 0);

	const percent = gates.length
		? Math.round((gates.reduce((s, g) => s + g, 0) / gates.length) * 100)
		: isComplete
			? 100
			: 0;

	return { allLessonsDone, isComplete, percent };
}

export interface PathCourseProgress {
	isRequired: boolean;
	isComplete: boolean;
	percent: number;
}

export interface PathCompletionResult {
	isComplete: boolean;
	percent: number;
}

/** A path is complete when its required courses (or, if none are marked
 *  required, ALL courses) are complete. Percent is the plain average across
 *  every course, required or not. */
export function calculatePathCompletion(
	courses: PathCourseProgress[],
): PathCompletionResult {
	const required = courses.filter((c) => c.isRequired);
	const gating = required.length > 0 ? required : courses;
	const isComplete = gating.length > 0 && gating.every((c) => c.isComplete);
	const percent = courses.length
		? Math.round(courses.reduce((s, c) => s + c.percent, 0) / courses.length)
		: isComplete
			? 100
			: 0;
	return { isComplete, percent };
}

export interface CohortItemProgress {
	isComplete: boolean;
	percent: number;
}

export interface CohortCompletionInput {
	courses: CohortItemProgress[];
	paths: CohortItemProgress[];
	assessmentsCount: number;
	allAssessmentsPassed: boolean;
	projectsCount: number;
	allProjectsPassed: boolean;
}

export interface CohortCompletionResult {
	allCoursesComplete: boolean;
	allPathsComplete: boolean;
	isComplete: boolean;
	percent: number;
}

export function calculateCohortCompletion(
	input: CohortCompletionInput,
): CohortCompletionResult {
	const allCoursesComplete =
		input.courses.length === 0 || input.courses.every((c) => c.isComplete);
	const allPathsComplete =
		input.paths.length === 0 || input.paths.every((p) => p.isComplete);
	const isComplete =
		allCoursesComplete &&
		allPathsComplete &&
		input.allAssessmentsPassed &&
		input.allProjectsPassed;

	const gates: number[] = [];
	if (input.courses.length > 0) {
		gates.push(
			input.courses.reduce((s, c) => s + c.percent, 0) /
				(input.courses.length * 100),
		);
	}
	if (input.paths.length > 0) {
		gates.push(
			input.paths.reduce((s, p) => s + p.percent, 0) /
				(input.paths.length * 100),
		);
	}
	if (input.assessmentsCount > 0) {
		gates.push(input.allAssessmentsPassed ? 1 : 0);
	}
	if (input.projectsCount > 0) gates.push(input.allProjectsPassed ? 1 : 0);

	const percent = gates.length
		? Math.round((gates.reduce((s, g) => s + g, 0) / gates.length) * 100)
		: isComplete
			? 100
			: 0;

	return { allCoursesComplete, allPathsComplete, isComplete, percent };
}
