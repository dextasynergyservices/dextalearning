/**
 * Learning-domain events (§6.4: contexts communicate by events, not calls).
 * Emitted by Completion/Assessments/Projects/Enrollment at the moments
 * "learning happened"; consumed by Engagement (streaks/badges/progress
 * events), Reminders (spaced-repetition review items), and Catalog
 * (social-proof counters). Payloads are snapshots — consumers must never
 * join back into the emitter's tables to enrich them (§6.4 rule 5).
 */
export const LearningEvents = {
	LessonCompleted: "learning.lesson.completed",
	EntityCompleted: "learning.entity.completed",
	AttemptSubmitted: "learning.attempt.submitted",
	ProjectGraded: "learning.project.graded",
	EnrollmentCreated: "learning.enrollment.created",
} as const;

export interface LessonCompletedEvent {
	userId: string;
	lessonId: string;
	courseId: string;
	lessonTitle: string;
	courseTitle: string;
	/** ISO timestamp of the completion flip. */
	completedAt: string;
}

export interface EntityCompletedEvent {
	userId: string;
	entityType: "course" | "path" | "cohort";
	entityId: string;
	completedAt: string;
}

export interface AttemptSubmittedEvent {
	userId: string;
	assessmentId: string;
	lessonId: string | null;
	scope: string;
	score: number;
	passed: boolean;
	attemptNumber: number;
}

export interface ProjectGradedEvent {
	userId: string;
	projectId: string;
	submissionId: string;
	score: number | null;
	passed: boolean;
}

export interface EnrollmentCreatedEvent {
	userId: string;
	entityType: "course" | "path" | "cohort";
	entityId: string;
}
