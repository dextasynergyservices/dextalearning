import { describe, expect, it } from "vitest";
import {
	calculateCohortCompletion,
	calculateCourseCompletion,
	calculatePathCompletion,
} from "./completion.calculator";

describe("calculateCourseCompletion", () => {
	it("is 0% for a course with no lessons/assessments/projects yet started", () => {
		const result = calculateCourseCompletion({
			lessonsDone: 0,
			lessonsTotal: 5,
			moduleAssessmentsCount: 0,
			allModuleAssessmentsPassed: true, // vacuously true — none exist
			finalRequired: false,
			finalAssessmentPassed: true,
			projectsCount: 0,
			allProjectsPassed: true,
		});
		expect(result.percent).toBe(0);
		expect(result.isComplete).toBe(false);
	});

	it("does NOT inflate percent from gates that don't apply (content-only course)", () => {
		// No module assessments, no final, no projects — only the lessons gate
		// applies, so 2/5 lessons done must read 40%, not diluted by phantom
		// "passing" gates for things that don't exist.
		const result = calculateCourseCompletion({
			lessonsDone: 2,
			lessonsTotal: 5,
			moduleAssessmentsCount: 0,
			allModuleAssessmentsPassed: true,
			finalRequired: false,
			finalAssessmentPassed: true,
			projectsCount: 0,
			allProjectsPassed: true,
		});
		expect(result.percent).toBe(40);
	});

	it("is 100% and complete when every applicable gate is satisfied", () => {
		const result = calculateCourseCompletion({
			lessonsDone: 5,
			lessonsTotal: 5,
			moduleAssessmentsCount: 2,
			allModuleAssessmentsPassed: true,
			finalRequired: true,
			finalAssessmentPassed: true,
			projectsCount: 1,
			allProjectsPassed: true,
		});
		expect(result.percent).toBe(100);
		expect(result.isComplete).toBe(true);
		expect(result.allLessonsDone).toBe(true);
	});

	it("averages across all four gate types when all apply", () => {
		// lessons 1.0, moduleAssessments 0 (failed), final 1.0 (passed), projects 0 (failed)
		// average = (1 + 0 + 1 + 0) / 4 = 0.5 -> 50%
		const result = calculateCourseCompletion({
			lessonsDone: 4,
			lessonsTotal: 4,
			moduleAssessmentsCount: 1,
			allModuleAssessmentsPassed: false,
			finalRequired: true,
			finalAssessmentPassed: true,
			projectsCount: 1,
			allProjectsPassed: false,
		});
		expect(result.percent).toBe(50);
		expect(result.isComplete).toBe(false);
	});

	it("is not complete if lessons are done but the final assessment isn't passed", () => {
		const result = calculateCourseCompletion({
			lessonsDone: 3,
			lessonsTotal: 3,
			moduleAssessmentsCount: 0,
			allModuleAssessmentsPassed: true,
			finalRequired: true,
			finalAssessmentPassed: false,
			projectsCount: 0,
			allProjectsPassed: true,
		});
		expect(result.isComplete).toBe(false);
		// lessons gate 1.0, final gate 0 -> average 50%
		expect(result.percent).toBe(50);
	});

	it("rounds to the nearest whole percent", () => {
		// 1 of 3 lessons done, no other gates -> 33.33% rounds to 33
		const result = calculateCourseCompletion({
			lessonsDone: 1,
			lessonsTotal: 3,
			moduleAssessmentsCount: 0,
			allModuleAssessmentsPassed: true,
			finalRequired: false,
			finalAssessmentPassed: true,
			projectsCount: 0,
			allProjectsPassed: true,
		});
		expect(result.percent).toBe(33);
	});

	it("treats a course with truly zero requirements as 100% (vacuously complete)", () => {
		const result = calculateCourseCompletion({
			lessonsDone: 0,
			lessonsTotal: 0,
			moduleAssessmentsCount: 0,
			allModuleAssessmentsPassed: true,
			finalRequired: false,
			finalAssessmentPassed: true,
			projectsCount: 0,
			allProjectsPassed: true,
		});
		expect(result.isComplete).toBe(true);
		expect(result.percent).toBe(100);
	});
});

describe("calculatePathCompletion", () => {
	it("is 0% with no courses", () => {
		const result = calculatePathCompletion([]);
		expect(result.percent).toBe(0);
		expect(result.isComplete).toBe(false);
	});

	it("averages plain percent across ALL courses, required or not", () => {
		const result = calculatePathCompletion([
			{ isRequired: true, isComplete: true, percent: 100 },
			{ isRequired: false, isComplete: false, percent: 0 },
		]);
		expect(result.percent).toBe(50);
	});

	it("gates completion on required courses only, when some are required", () => {
		const result = calculatePathCompletion([
			{ isRequired: true, isComplete: true, percent: 100 },
			{ isRequired: false, isComplete: false, percent: 0 },
		]);
		// the one required course is done -> path is complete, even though the
		// optional course isn't.
		expect(result.isComplete).toBe(true);
	});

	it("gates completion on ALL courses when none are marked required", () => {
		const result = calculatePathCompletion([
			{ isRequired: false, isComplete: true, percent: 100 },
			{ isRequired: false, isComplete: false, percent: 0 },
		]);
		expect(result.isComplete).toBe(false);
	});

	it("is complete only when every required course is complete", () => {
		const result = calculatePathCompletion([
			{ isRequired: true, isComplete: true, percent: 100 },
			{ isRequired: true, isComplete: false, percent: 60 },
		]);
		expect(result.isComplete).toBe(false);
		expect(result.percent).toBe(80);
	});
});

describe("calculateCohortCompletion", () => {
	it("is vacuously 100% complete with nothing attached (no gates to fail)", () => {
		const result = calculateCohortCompletion({
			courses: [],
			paths: [],
			assessmentsCount: 0,
			allAssessmentsPassed: true,
			projectsCount: 0,
			allProjectsPassed: true,
		});
		expect(result.isComplete).toBe(true);
		expect(result.percent).toBe(100);
	});

	it("averages course/path percent contributions alongside pass/fail gates", () => {
		// courses avg 50% -> 0.5, assessments passed -> 1, no paths/projects
		// average = (0.5 + 1) / 2 = 0.75 -> 75%
		const result = calculateCohortCompletion({
			courses: [
				{ isComplete: true, percent: 100 },
				{ isComplete: false, percent: 0 },
			],
			paths: [],
			assessmentsCount: 1,
			allAssessmentsPassed: true,
			projectsCount: 0,
			allProjectsPassed: true,
		});
		expect(result.percent).toBe(75);
	});

	it("is not complete if any attached course is incomplete", () => {
		const result = calculateCohortCompletion({
			courses: [
				{ isComplete: true, percent: 100 },
				{ isComplete: false, percent: 50 },
			],
			paths: [],
			assessmentsCount: 0,
			allAssessmentsPassed: true,
			projectsCount: 0,
			allProjectsPassed: true,
		});
		expect(result.allCoursesComplete).toBe(false);
		expect(result.isComplete).toBe(false);
	});

	it("is complete when courses, paths, assessments and projects are all satisfied", () => {
		const result = calculateCohortCompletion({
			courses: [{ isComplete: true, percent: 100 }],
			paths: [{ isComplete: true, percent: 100 }],
			assessmentsCount: 2,
			allAssessmentsPassed: true,
			projectsCount: 1,
			allProjectsPassed: true,
		});
		expect(result.isComplete).toBe(true);
		expect(result.percent).toBe(100);
	});
});
