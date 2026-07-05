import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import {
	createAssessment,
	createQuestion,
} from "../integration/support/factories";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("AttemptsController (e2e)", () => {
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
		const assessment = await createAssessment(prisma);
		await request(app.getHttpServer())
			.get(`/api/v1/assessments/${assessment.id}/info`)
			.expect(401);
	});

	it("runs the full attempt lifecycle: info -> start -> answer -> submit -> result", async () => {
		const assessment = await createAssessment(prisma, { passMark: 50 });
		const question = await createQuestion(prisma, assessment.id);
		await prisma.question.update({
			where: { id: question.id },
			data: { correctAnswer: "A" },
		});

		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });

		const info = await agent
			.get(`/api/v1/assessments/${assessment.id}/info`)
			.expect(200);
		expect(info.body.data.canStart).toBe(true);

		const started = await agent
			.post(`/api/v1/assessments/${assessment.id}/attempts`)
			.expect(201);
		const attemptId = started.body.data.attemptId;
		expect(started.body.data.status).toBe("in_progress");

		await agent
			.patch(`/api/v1/attempts/${attemptId}/answer`)
			.send({ questionId: question.id, answer: "A" })
			.expect(200);

		const submitted = await agent
			.post(`/api/v1/attempts/${attemptId}/submit`)
			.send({})
			.expect(201);
		expect(submitted.body.data.score).toBe(100);
		expect(submitted.body.data.passed).toBe(true);

		const result = await agent
			.get(`/api/v1/attempts/${attemptId}/result`)
			.expect(200);
		expect(result.body.data).toBeTruthy();
	});

	it("forbids another learner from accessing someone else's attempt", async () => {
		const assessment = await createAssessment(prisma);
		await createQuestion(prisma, assessment.id);
		const { agent: ownerAgent } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		const started = await ownerAgent
			.post(`/api/v1/assessments/${assessment.id}/attempts`)
			.expect(201);

		const { agent: otherAgent } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		await otherAgent
			.get(`/api/v1/attempts/${started.body.data.attemptId}`)
			.expect(403);
	});
});
