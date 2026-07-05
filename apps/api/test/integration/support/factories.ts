import { randomUUID } from "node:crypto";
import type {
	Assessment,
	AssessmentAttempt,
	AssessmentScope,
	Cohort,
	CohortCourse,
	CohortPath,
	CohortStatus,
	Course,
	CourseLevel,
	LearningPath,
	Lesson,
	LessonContentType,
	Module,
	PathCourse,
	PathLevel,
	Project,
	ProjectGradingType,
	ProjectScope,
	ProjectSubmission,
	PublishStatus,
	Question,
	User,
	UserRole,
} from "../../../generated/prisma/client";
import type { PrismaService } from "../../../src/prisma/prisma.service";

/** Minimal fixture builders for integration specs — only the fields each
 *  model actually requires, plus an `overrides` escape hatch per test. */

export function createUser(
	prisma: PrismaService,
	overrides: Partial<{
		email: string;
		firstName: string;
		lastName: string;
		role: UserRole;
	}> = {},
): Promise<User> {
	const id = randomUUID().slice(0, 8);
	return prisma.user.create({
		data: {
			email: overrides.email ?? `user-${id}@example.com`,
			firstName: overrides.firstName ?? "Test",
			lastName: overrides.lastName ?? "User",
			role: overrides.role ?? "learner",
		},
	});
}

export function createCourse(
	prisma: PrismaService,
	overrides: Partial<{
		title: string;
		slug: string;
		status: PublishStatus | null;
		level: CourseLevel;
	}> = {},
): Promise<Course> {
	const id = randomUUID().slice(0, 8);
	return prisma.course.create({
		data: {
			title: overrides.title ?? `Test Course ${id}`,
			slug: overrides.slug ?? `test-course-${id}`,
			status: overrides.status ?? "published",
			...(overrides.level ? { level: overrides.level } : {}),
		},
	});
}

export function createPath(
	prisma: PrismaService,
	overrides: Partial<{
		title: string;
		slug: string;
		status: PublishStatus | null;
		level: PathLevel;
	}> = {},
): Promise<LearningPath> {
	const id = randomUUID().slice(0, 8);
	return prisma.learningPath.create({
		data: {
			title: overrides.title ?? `Test Path ${id}`,
			slug: overrides.slug ?? `test-path-${id}`,
			status: overrides.status ?? "published",
			...(overrides.level ? { level: overrides.level } : {}),
		},
	});
}

export function createCohort(
	prisma: PrismaService,
	overrides: Partial<{
		title: string;
		slug: string;
		status: CohortStatus | null;
	}> = {},
): Promise<Cohort> {
	const id = randomUUID().slice(0, 8);
	return prisma.cohort.create({
		data: {
			title: overrides.title ?? `Test Cohort ${id}`,
			slug: overrides.slug ?? `test-cohort-${id}`,
			status: overrides.status ?? "open",
		},
	});
}

export function createModule(
	prisma: PrismaService,
	courseId: string,
	overrides: Partial<{ title: string; orderIndex: number }> = {},
): Promise<Module> {
	return prisma.module.create({
		data: {
			courseId,
			title: overrides.title ?? "Test Module",
			orderIndex: overrides.orderIndex ?? 1,
		},
	});
}

export function createLesson(
	prisma: PrismaService,
	moduleId: string,
	overrides: Partial<{
		title: string;
		orderIndex: number;
		contentType: LessonContentType;
		minVideoWatchPct: number;
		hasPostQuiz: boolean;
	}> = {},
): Promise<Lesson> {
	return prisma.lesson.create({
		data: {
			moduleId,
			title: overrides.title ?? "Test Lesson",
			orderIndex: overrides.orderIndex ?? 1,
			contentType: overrides.contentType ?? "video",
			...(overrides.minVideoWatchPct !== undefined
				? { minVideoWatchPct: overrides.minVideoWatchPct }
				: {}),
			...(overrides.hasPostQuiz !== undefined
				? { hasPostQuiz: overrides.hasPostQuiz }
				: {}),
		},
	});
}

export function createAssessment(
	prisma: PrismaService,
	overrides: Partial<{
		scope: AssessmentScope;
		title: string;
		passMark: number;
		lessonId: string;
		moduleId: string;
		courseId: string;
		pathId: string;
		cohortId: string;
	}> = {},
): Promise<Assessment> {
	return prisma.assessment.create({
		data: {
			scope: overrides.scope ?? "course_final",
			title: overrides.title ?? "Test Assessment",
			...(overrides.passMark !== undefined
				? { passMark: overrides.passMark }
				: {}),
			...(overrides.lessonId ? { lessonId: overrides.lessonId } : {}),
			...(overrides.moduleId ? { moduleId: overrides.moduleId } : {}),
			...(overrides.courseId ? { courseId: overrides.courseId } : {}),
			...(overrides.pathId ? { pathId: overrides.pathId } : {}),
			...(overrides.cohortId ? { cohortId: overrides.cohortId } : {}),
		},
	});
}

export function createQuestion(
	prisma: PrismaService,
	assessmentId: string,
	overrides: Partial<{ points: number }> = {},
): Promise<Question> {
	return prisma.question.create({
		data: {
			assessmentId,
			body: "Test question?",
			correctAnswer: "A",
			points: overrides.points ?? 1,
		},
	});
}

export function createAssessmentAttempt(
	prisma: PrismaService,
	overrides: {
		assessmentId: string;
		userId: string;
		passed: boolean;
		score?: number;
		invalidated?: boolean;
		attemptNumber?: number;
	},
): Promise<AssessmentAttempt> {
	return prisma.assessmentAttempt.create({
		data: {
			assessmentId: overrides.assessmentId,
			userId: overrides.userId,
			attemptNumber: overrides.attemptNumber ?? 1,
			passed: overrides.passed,
			score: overrides.score ?? (overrides.passed ? 100 : 0),
			invalidated: overrides.invalidated ?? false,
			submittedAt: new Date(),
		},
	});
}

export function createProject(
	prisma: PrismaService,
	overrides: Partial<{
		scope: ProjectScope;
		title: string;
		passMark: number;
		gradingType: ProjectGradingType;
		orderIndex: number;
		courseId: string;
		pathId: string;
		cohortId: string;
	}> = {},
): Promise<Project> {
	return prisma.project.create({
		data: {
			scope: overrides.scope ?? "course",
			title: overrides.title ?? "Test Project",
			gradingType: overrides.gradingType ?? "manual",
			orderIndex: overrides.orderIndex ?? 1,
			...(overrides.passMark !== undefined
				? { passMark: overrides.passMark }
				: {}),
			...(overrides.courseId ? { courseId: overrides.courseId } : {}),
			...(overrides.pathId ? { pathId: overrides.pathId } : {}),
			...(overrides.cohortId ? { cohortId: overrides.cohortId } : {}),
		},
	});
}

export function createProjectSubmission(
	prisma: PrismaService,
	overrides: {
		projectId: string;
		userId: string;
		passed: boolean;
		score?: number;
	},
): Promise<ProjectSubmission> {
	return prisma.projectSubmission.create({
		data: {
			projectId: overrides.projectId,
			userId: overrides.userId,
			passed: overrides.passed,
			score: overrides.score ?? (overrides.passed ? 100 : 0),
		},
	});
}

export function createPathCourse(
	prisma: PrismaService,
	overrides: {
		pathId: string;
		courseId: string;
		isRequired?: boolean;
		orderIndex?: number;
	},
): Promise<PathCourse> {
	return prisma.pathCourse.create({
		data: {
			pathId: overrides.pathId,
			courseId: overrides.courseId,
			orderIndex: overrides.orderIndex ?? 1,
			isRequired: overrides.isRequired ?? true,
		},
	});
}

export function createCohortCourse(
	prisma: PrismaService,
	overrides: { cohortId: string; courseId: string; orderIndex?: number },
): Promise<CohortCourse> {
	return prisma.cohortCourse.create({
		data: {
			cohortId: overrides.cohortId,
			courseId: overrides.courseId,
			orderIndex: overrides.orderIndex ?? 1,
		},
	});
}

export function createCohortPath(
	prisma: PrismaService,
	overrides: { cohortId: string; pathId: string; orderIndex?: number },
): Promise<CohortPath> {
	return prisma.cohortPath.create({
		data: {
			cohortId: overrides.cohortId,
			pathId: overrides.pathId,
			orderIndex: overrides.orderIndex ?? 1,
		},
	});
}
