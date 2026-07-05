import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { createCourse } from "../integration/support/factories";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

async function loginAsAdmin(
	app: NestExpressApplication,
	prisma: PrismaService,
) {
	const { agent, userId } = await registerAndLogin(app, prisma, {
		role: "learner",
	});
	await prisma.user.update({ where: { id: userId }, data: { role: "admin" } });
	return agent;
}

describe("CohortsController (e2e)", () => {
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
		await request(app.getHttpServer()).get("/api/v1/cohorts").expect(401);
	});

	it("403s for a non-admin instructor", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		await agent.get("/api/v1/cohorts").expect(403);
	});

	it("creates a cohort and adds a course as admin", async () => {
		const admin = await loginAsAdmin(app, prisma);
		const created = await admin
			.post("/api/v1/cohorts")
			.send({ title: "New Cohort" })
			.expect(201);
		expect(created.body.data.status).toBe("draft");

		const course = await createCourse(prisma);
		await admin
			.post(`/api/v1/cohorts/${created.body.data.id}/courses`)
			.send({ courseId: course.id })
			.expect(201);

		const detail = await admin
			.get(`/api/v1/cohorts/${created.body.data.id}`)
			.expect(200);
		expect(detail.body.data.courses).toHaveLength(1);
	});

	it("rejects publishing without a start date or courses (422)", async () => {
		const admin = await loginAsAdmin(app, prisma);
		const created = await admin
			.post("/api/v1/cohorts")
			.send({ title: "Not ready" })
			.expect(201);
		await admin
			.post(`/api/v1/cohorts/${created.body.data.id}/publish`)
			.expect(422);
	});
});
