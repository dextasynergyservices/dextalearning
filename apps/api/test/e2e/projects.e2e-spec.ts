import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import {
	createProjectSubmission,
	createUser,
} from "../integration/support/factories";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("ProjectsController (e2e)", () => {
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

	it("401s without a session", async () => {
		await request(app.getHttpServer()).get("/api/v1/projects").expect(401);
	});

	it("403s for a learner", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.post("/api/v1/projects")
			.send({ scope: "course", title: "Nope" })
			.expect(403);
	});

	it("creates a project on the caller's own course, then grades a submission", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const course = await agent
			.post("/api/v1/courses")
			.send({ title: "Project Course" })
			.expect(201);

		const project = await agent
			.post("/api/v1/projects")
			.send({
				scope: "course",
				title: "Final Project",
				courseId: course.body.data.id,
			})
			.expect(201);
		expect(project.body.data.orderIndex).toBe(1);

		const learner = await createUser(prisma, { role: "learner" });
		const submission = await createProjectSubmission(prisma, {
			projectId: project.body.data.id,
			userId: learner.id,
			passed: false,
		});

		const graded = await agent
			.post(`/api/v1/projects/submissions/${submission.id}/grade`)
			.send({ score: 85, passed: true })
			.expect(201);
		expect(graded.body.data.score).toBe(85);
		expect(graded.body.data.passed).toBe(true);
	});
});
