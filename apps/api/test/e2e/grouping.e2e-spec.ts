import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("GroupingController + FacilitatorController (e2e)", () => {
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
			data: {
				title: "E2E Cohort",
				slug: `e2e-${Date.now()}`,
				groupingMode: "manual",
			},
		});
		return cohort.id;
	}

	it("401s without a session", async () => {
		const cohortId = await makeCohort();
		await request(app.getHttpServer())
			.get(`/api/v1/cohorts/${cohortId}/grouping`)
			.expect(401);
	});

	it("403s a signed-in user who is not admin and not an assigned facilitator", async () => {
		const cohortId = await makeCohort();
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent.get(`/api/v1/cohorts/${cohortId}/grouping`).expect(403);
	});

	it("lets an admin read the grouping board", async () => {
		const cohortId = await makeCohort();
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		await prisma.user.update({
			where: { id: userId },
			data: { role: "admin" },
		});
		const res = await agent
			.get(`/api/v1/cohorts/${cohortId}/grouping`)
			.expect(200);
		expect(res.body.data.cohort.id).toBe(cohortId);
		expect(res.body.data.groups).toEqual([]);
	});

	it("admits a LEARNER once assigned as the cohort's facilitator, and lists it in their portal", async () => {
		const cohortId = await makeCohort();
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});

		// Before assignment: blocked, and the portal is empty.
		await agent.get(`/api/v1/cohorts/${cohortId}/grouping`).expect(403);
		const before = await agent.get("/api/v1/facilitator/cohorts").expect(200);
		expect(before.body.data).toEqual([]);

		await prisma.cohortFacilitator.create({
			data: { cohortId, userId },
		});

		// After assignment: full access despite a non-facilitator global role.
		await agent.get(`/api/v1/cohorts/${cohortId}/grouping`).expect(200);
		const after = await agent.get("/api/v1/facilitator/cohorts").expect(200);
		expect(after.body.data).toHaveLength(1);
		expect(after.body.data[0].id).toBe(cohortId);
	});
});
