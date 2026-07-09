import { ForbiddenException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { AnalyticsService } from "../../src/modules/analytics/analytics.service";
import { getTestPrisma } from "./support/db";
import {
	createAssessment,
	createCourse,
	createLesson,
	createModule,
	createUser,
} from "./support/factories";

function asUser(id: string, role: "instructor" | "admin"): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role };
}

describe("AnalyticsService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new AnalyticsService(prisma);

	let instructorId: string;

	beforeEach(async () => {
		instructorId = (await createUser(prisma, { role: "instructor" })).id;
	});

	/** Course + 3 learners: one completed, one halfway, one never started. */
	async function seedCourseWithActivity(createdBy: string) {
		const course = await createCourse(prisma, {
			status: "published",
			createdBy,
		});
		const [done, halfway, idle] = await Promise.all([
			createUser(prisma, { role: "learner" }),
			createUser(prisma, { role: "learner" }),
			createUser(prisma, { role: "learner" }),
		]);
		await prisma.courseEnrollment.createMany({
			data: [done, halfway, idle].map((u) => ({
				courseId: course.id,
				userId: u.id,
			})),
		});
		await prisma.completionStatus.createMany({
			data: [
				{
					userId: done.id,
					entityType: "course",
					entityId: course.id,
					isComplete: true,
					progressPercent: 100,
					completedAt: new Date(),
				},
				{
					userId: halfway.id,
					entityType: "course",
					entityId: course.id,
					isComplete: false,
					progressPercent: 50,
				},
			],
		});
		return course;
	}

	it("computes enrolled / completed / in-progress / not-started + rates per course", async () => {
		const course = await seedCourseWithActivity(instructorId);

		const overview = await service.instructorOverview(
			asUser(instructorId, "instructor"),
		);
		expect(overview.courses).toHaveLength(1);
		expect(overview.courses[0]).toMatchObject({
			id: course.id,
			enrolled: 3,
			completed: 1,
			inProgress: 1,
			notStarted: 1,
			completionRate: 33, // 1 of 3
			avgProgressPct: 50, // (100 + 50 + 0) / 3
		});
		expect(overview.courses[0].lastEnrolledAt).not.toBeNull();
		expect(overview.totals).toMatchObject({
			courses: 1,
			published: 1,
			enrollments: 3,
			completions: 1,
			completionRate: 33,
			learnersReached: 3,
		});
	});

	it("scopes instructors to their OWN content; admins see everything (§2.4)", async () => {
		await seedCourseWithActivity(instructorId);
		const other = await createUser(prisma, { role: "instructor" });
		await seedCourseWithActivity(other.id);

		const own = await service.instructorOverview(
			asUser(instructorId, "instructor"),
		);
		expect(own.courses).toHaveLength(1);
		expect(own.totals.enrollments).toBe(3);

		const admin = await createUser(prisma, { role: "admin" });
		const all = await service.instructorOverview(asUser(admin.id, "admin"));
		expect(all.courses).toHaveLength(2);
		expect(all.totals.enrollments).toBe(6);
	});

	it("learnersReached counts DISTINCT learners across the instructor's courses", async () => {
		const courseA = await createCourse(prisma, { createdBy: instructorId });
		const courseB = await createCourse(prisma, { createdBy: instructorId });
		const learner = await createUser(prisma, { role: "learner" });
		await prisma.courseEnrollment.createMany({
			data: [
				{ courseId: courseA.id, userId: learner.id },
				{ courseId: courseB.id, userId: learner.id },
			],
		});

		const overview = await service.instructorOverview(
			asUser(instructorId, "instructor"),
		);
		expect(overview.totals.enrollments).toBe(2);
		expect(overview.totals.learnersReached).toBe(1);
	});

	it("adminOverview reports platform counts, 7d activity and instructor names", async () => {
		const course = await seedCourseWithActivity(instructorId);
		// Learning activity inside the 7-day window (§15 progress_events).
		const activeLearner = await createUser(prisma, { role: "learner" });
		await prisma.progressEvent.create({
			data: {
				userId: activeLearner.id,
				entityType: "lesson",
				entityId: course.id,
				eventType: "completed",
			},
		});

		const overview = await service.adminOverview();
		expect(overview.platform.learners).toBeGreaterThanOrEqual(4);
		expect(overview.platform.instructors).toBeGreaterThanOrEqual(1);
		expect(overview.platform.publishedCourses).toBe(1);
		expect(overview.platform.enrollments).toBe(3);
		expect(overview.platform.completions).toBe(1);
		expect(overview.platform.completionRate).toBe(33);
		expect(overview.platform.activeLearners7d).toBe(1);
		expect(overview.platform.newLearners30d).toBeGreaterThanOrEqual(4);

		const row = overview.courses.find((c) => c.id === course.id);
		expect(row?.instructorName).toBeTruthy();
		expect(row?.enrolled).toBe(3);
	});

	it("covers PATHS too: enrolments + completion status per path (own content)", async () => {
		const path = await prisma.learningPath.create({
			data: {
				title: "Frontend Path",
				slug: `p-${crypto.randomUUID().slice(0, 8)}`,
				status: "published",
				createdBy: instructorId,
			},
		});
		const learner = await createUser(prisma, { role: "learner" });
		await prisma.pathEnrollment.create({
			data: { pathId: path.id, userId: learner.id },
		});
		await prisma.completionStatus.create({
			data: {
				userId: learner.id,
				entityType: "path",
				entityId: path.id,
				isComplete: true,
				progressPercent: 100,
				completedAt: new Date(),
			},
		});

		const overview = await service.instructorOverview(
			asUser(instructorId, "instructor"),
		);
		expect(overview.paths).toHaveLength(1);
		expect(overview.paths[0]).toMatchObject({
			id: path.id,
			enrolled: 1,
			completed: 1,
			completionRate: 100,
		});
		expect(overview.totals.paths).toBe(1);
		expect(overview.totals.learnersReached).toBe(1);
	});

	it("adminOverview includes cohorts with their analytics rows", async () => {
		const cohort = await prisma.cohort.create({
			data: {
				title: "January Cohort",
				slug: `c-${crypto.randomUUID().slice(0, 8)}`,
				status: "open",
			},
		});
		const learner = await createUser(prisma, { role: "learner" });
		await prisma.cohortEnrollment.create({
			data: { cohortId: cohort.id, userId: learner.id },
		});

		const overview = await service.adminOverview();
		const row = overview.cohorts.find((c) => c.id === cohort.id);
		expect(row).toMatchObject({ enrolled: 1, completed: 0, live: true });
	});

	it("listLearners names each learner with their progress; ownership is enforced (§2.4)", async () => {
		const course = await seedCourseWithActivity(instructorId);

		const result = await service.listLearners(
			asUser(instructorId, "instructor"),
			"course",
			course.id,
		);
		expect(result.entity).toMatchObject({ id: course.id, type: "course" });
		expect(result.learners).toHaveLength(3);
		const done = result.learners.find((l) => l.isComplete);
		expect(done?.progressPercent).toBe(100);
		expect(done?.name).toBeTruthy();
		const idle = result.learners.filter(
			(l) => !l.isComplete && l.progressPercent === 0,
		);
		expect(idle).toHaveLength(1); // never-started learner reads as 0%

		// Another instructor must NOT see this course's learners.
		const other = await createUser(prisma, { role: "instructor" });
		await expect(
			service.listLearners(asUser(other.id, "instructor"), "course", course.id),
		).rejects.toThrow(ForbiddenException);

		// Admin bypasses ownership.
		const admin = await createUser(prisma, { role: "admin" });
		const adminView = await service.listLearners(
			asUser(admin.id, "admin"),
			"course",
			course.id,
		);
		expect(adminView.learners).toHaveLength(3);
	});

	it("getLearnerDetail: per-lesson completion + post-quiz scores + assessment best (course)", async () => {
		const course = await createCourse(prisma, { createdBy: instructorId });
		const mod = await createModule(prisma, course.id);
		const lessonA = await createLesson(prisma, mod.id, {
			title: "Lesson A",
			orderIndex: 1,
		});
		await createLesson(prisma, mod.id, {
			title: "Lesson B",
			orderIndex: 2,
		});
		const finalAssessment = await createAssessment(prisma, {
			scope: "course_final",
			courseId: course.id,
			title: "Final",
		});
		const learner = await createUser(prisma, { role: "learner" });
		await prisma.courseEnrollment.create({
			data: { courseId: course.id, userId: learner.id },
		});
		await prisma.completionStatus.create({
			data: {
				userId: learner.id,
				entityType: "course",
				entityId: course.id,
				progressPercent: 50,
				isComplete: false,
			},
		});
		// Lesson A done with an 80% post-quiz; Lesson B untouched.
		await prisma.lessonCompletion.create({
			data: {
				userId: learner.id,
				lessonId: lessonA.id,
				completedAt: new Date(),
				postQuizScore: 80,
			},
		});
		// Two attempts on the final — best (90) wins.
		await prisma.assessmentAttempt.createMany({
			data: [
				{
					assessmentId: finalAssessment.id,
					userId: learner.id,
					attemptNumber: 1,
					submittedAt: new Date(),
					score: 60,
					passed: false,
				},
				{
					assessmentId: finalAssessment.id,
					userId: learner.id,
					attemptNumber: 2,
					submittedAt: new Date(),
					score: 90,
					passed: true,
				},
			],
		});

		const detail = await service.getLearnerDetail(
			asUser(instructorId, "instructor"),
			"course",
			course.id,
			learner.id,
		);
		expect(detail.learner).toMatchObject({
			userId: learner.id,
			progressPercent: 50,
			isComplete: false,
		});
		expect(detail.lessons).toHaveLength(2);
		expect(detail.lessons?.[0]).toMatchObject({
			title: "Lesson A",
			completed: true,
			postQuizScore: 80,
		});
		expect(detail.lessons?.[1]).toMatchObject({
			title: "Lesson B",
			completed: false,
			postQuizScore: null,
		});
		expect(detail.assessments?.[0]).toMatchObject({
			title: "Final",
			bestScore: 90,
			passed: true,
		});
	});

	it("getLearnerDetail: per-component progress for a path; ownership enforced", async () => {
		const path = await prisma.learningPath.create({
			data: {
				title: "Fullstack Path",
				slug: `p-${crypto.randomUUID().slice(0, 8)}`,
				status: "published",
				createdBy: instructorId,
			},
		});
		const courseA = await createCourse(prisma, { title: "HTML" });
		const courseB = await createCourse(prisma, { title: "CSS" });
		await prisma.pathCourse.createMany({
			data: [
				{ pathId: path.id, courseId: courseA.id, orderIndex: 1 },
				{ pathId: path.id, courseId: courseB.id, orderIndex: 2 },
			],
		});
		const learner = await createUser(prisma, { role: "learner" });
		await prisma.pathEnrollment.create({
			data: { pathId: path.id, userId: learner.id },
		});
		await prisma.completionStatus.create({
			data: {
				userId: learner.id,
				entityType: "course",
				entityId: courseA.id,
				progressPercent: 100,
				isComplete: true,
			},
		});

		const detail = await service.getLearnerDetail(
			asUser(instructorId, "instructor"),
			"path",
			path.id,
			learner.id,
		);
		expect(detail.components).toHaveLength(2);
		expect(detail.components?.[0]).toMatchObject({
			title: "HTML",
			progressPercent: 100,
			isComplete: true,
		});
		expect(detail.components?.[1]).toMatchObject({
			title: "CSS",
			progressPercent: 0,
			isComplete: false,
		});

		const other = await createUser(prisma, { role: "instructor" });
		await expect(
			service.getLearnerDetail(
				asUser(other.id, "instructor"),
				"path",
				path.id,
				learner.id,
			),
		).rejects.toThrow(ForbiddenException);
	});

	it("returns clean zeroes for an instructor with no content yet", async () => {
		const overview = await service.instructorOverview(
			asUser(instructorId, "instructor"),
		);
		expect(overview.courses).toEqual([]);
		expect(overview.totals).toMatchObject({
			courses: 0,
			enrollments: 0,
			completions: 0,
			completionRate: 0,
			learnersReached: 0,
		});
	});
});
