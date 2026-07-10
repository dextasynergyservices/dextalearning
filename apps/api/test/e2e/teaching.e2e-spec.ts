import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("TeachingController (e2e)", () => {
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

	async function makeCohort() {
		const cohort = await prisma.cohort.create({
			data: { title: "Teach Cohort", slug: `teach-${Date.now()}` },
		});
		return cohort.id;
	}

	it("401s without a session", async () => {
		await request(app.getHttpServer())
			.get("/api/v1/instructor/cohorts")
			.expect(401);
	});

	it("lets an assigned instructor list and read their cohort; blocks others", async () => {
		const cohortId = await makeCohort();
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});

		// Before assignment: empty list, and detail is forbidden.
		expect(
			(await agent.get("/api/v1/instructor/cohorts").expect(200)).body.data,
		).toEqual([]);
		await agent.get(`/api/v1/instructor/cohorts/${cohortId}`).expect(403);

		await prisma.cohortInstructor.create({
			data: { cohortId, userId },
		});

		const list = await agent.get("/api/v1/instructor/cohorts").expect(200);
		expect(list.body.data).toHaveLength(1);
		expect(list.body.data[0].id).toBe(cohortId);

		const detail = await agent
			.get(`/api/v1/instructor/cohorts/${cohortId}`)
			.expect(200);
		expect(detail.body.data.id).toBe(cohortId);
		expect(Array.isArray(detail.body.data.learners)).toBe(true);
	});

	it("403s a learner (content-creator role required)", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent.get("/api/v1/instructor/cohorts").expect(403);
	});
});
