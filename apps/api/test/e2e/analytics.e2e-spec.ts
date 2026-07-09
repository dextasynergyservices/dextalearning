import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { createCourse, createUser } from "../integration/support/factories";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("AnalyticsController (e2e)", () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		({ app, prisma } = await buildE2eApp());
	});

	beforeEach(async () => {
		await resetDatabase(prisma);
	});

	afterAll(async () => {
		await app.close();
	});

	it("401s without a session; 403s learners on both endpoints", async () => {
		await request(app.getHttpServer())
			.get("/api/v1/analytics/instructor")
			.expect(401);

		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent.get("/api/v1/analytics/instructor").expect(403);
		await agent.get("/api/v1/analytics/admin").expect(403);
	});

	it("instructor gets own-content analytics; admin endpoint stays 403", async () => {
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const course = await createCourse(prisma, { createdBy: userId });
		const learner = await createUser(prisma, { role: "learner" });
		await prisma.courseEnrollment.create({
			data: { courseId: course.id, userId: learner.id },
		});
		// Someone else's course must never appear.
		await createCourse(prisma, {});

		const res = await agent.get("/api/v1/analytics/instructor").expect(200);
		expect(res.body.data.courses).toHaveLength(1);
		expect(res.body.data.courses[0]).toMatchObject({
			id: course.id,
			enrolled: 1,
			completed: 0,
		});
		expect(res.body.data.totals.learnersReached).toBe(1);

		await agent.get("/api/v1/analytics/admin").expect(403);
	});

	it("learner drill-down is ownership-scoped and rejects unknown entity types", async () => {
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const own = await createCourse(prisma, { createdBy: userId });
		const foreign = await createCourse(prisma, {});
		const learner = await createUser(prisma, { role: "learner" });
		await prisma.courseEnrollment.create({
			data: { courseId: own.id, userId: learner.id },
		});

		const res = await agent
			.get(`/api/v1/analytics/course/${own.id}/learners`)
			.expect(200);
		expect(res.body.data.learners).toHaveLength(1);
		expect(res.body.data.learners[0].name).toBeTruthy();
		expect(res.body.data.learners[0]).toHaveProperty("progressPercent");

		await agent
			.get(`/api/v1/analytics/course/${foreign.id}/learners`)
			.expect(403);
		await agent.get(`/api/v1/analytics/webinar/${own.id}/learners`).expect(404);
	});

	it("per-student detail returns the learner's course breakdown (ownership-scoped)", async () => {
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const course = await createCourse(prisma, { createdBy: userId });
		const learner = await createUser(prisma, { role: "learner" });
		await prisma.courseEnrollment.create({
			data: { courseId: course.id, userId: learner.id },
		});
		await prisma.completionStatus.create({
			data: {
				userId: learner.id,
				entityType: "course",
				entityId: course.id,
				progressPercent: 25,
				isComplete: false,
			},
		});

		const res = await agent
			.get(`/api/v1/analytics/course/${course.id}/learners/${learner.id}`)
			.expect(200);
		expect(res.body.data.learner).toMatchObject({
			userId: learner.id,
			progressPercent: 25,
		});
		expect(Array.isArray(res.body.data.lessons)).toBe(true);

		// Ownership + unknown type guards.
		const foreign = await createCourse(prisma, {});
		await agent
			.get(`/api/v1/analytics/course/${foreign.id}/learners/${learner.id}`)
			.expect(403);
		await agent
			.get(`/api/v1/analytics/webinar/${course.id}/learners/${learner.id}`)
			.expect(404);
	});

	it("admin gets the platform-wide overview", async () => {
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		await prisma.user.update({
			where: { id: userId },
			data: { role: "admin" },
		});
		await createCourse(prisma, { status: "published" });

		const res = await agent.get("/api/v1/analytics/admin").expect(200);
		expect(res.body.data.platform.publishedCourses).toBe(1);
		expect(res.body.data.platform).toHaveProperty("activeLearners7d");
		expect(res.body.data.platform).toHaveProperty("completionRate");
		expect(res.body.data.courses).toHaveLength(1);
	});
});
