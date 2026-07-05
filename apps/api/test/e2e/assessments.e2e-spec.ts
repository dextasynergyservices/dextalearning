import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("AssessmentsController (e2e)", () => {
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
		await request(app.getHttpServer()).get("/api/v1/assessments").expect(401);
	});

	it("403s for a learner", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.post("/api/v1/assessments")
			.send({ scope: "course_final" })
			.expect(403);
	});

	it("creates a course-final assessment + a question, as the owning instructor", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const course = await agent
			.post("/api/v1/courses")
			.send({ title: "Assessed Course" })
			.expect(201);

		const assessment = await agent
			.post("/api/v1/assessments")
			.send({ scope: "course_final", courseId: course.body.data.id })
			.expect(201);
		expect(assessment.body.data.scope).toBe("course_final");

		const question = await agent
			.post(`/api/v1/assessments/${assessment.body.data.id}/questions`)
			.send({
				type: "mcq",
				body: "2 + 2 = ?",
				options: ["3", "4"],
				correctAnswer: "4",
			})
			.expect(201);
		expect(question.body.data.body).toBe("2 + 2 = ?");

		const list = await agent
			.get(`/api/v1/assessments?courseId=${course.body.data.id}`)
			.expect(200);
		expect(list.body.data).toHaveLength(1);
	});

	it("forbids a non-owner instructor from creating an assessment on someone else's course", async () => {
		const { agent: ownerAgent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const course = await ownerAgent
			.post("/api/v1/courses")
			.send({ title: "Guarded Course" })
			.expect(201);

		const { agent: otherAgent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		await otherAgent
			.post("/api/v1/assessments")
			.send({ scope: "course_final", courseId: course.body.data.id })
			.expect(403);
	});
});
