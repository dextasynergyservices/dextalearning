import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("ReportsController (e2e)", () => {
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
		await request(app.getHttpServer())
			.get("/api/v1/assessment-reports/all")
			.expect(401);
	});

	it("403s for a learner (RolesGuard: instructor|admin only)", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent.get("/api/v1/assessment-reports/all").expect(403);
	});

	it("403s for an instructor too — 'all reports' is admin-only at the service layer", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		await agent.get("/api/v1/assessment-reports/all").expect(403);
	});

	it("200s for an admin", async () => {
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		await prisma.user.update({
			where: { id: userId },
			data: { role: "admin" },
		});
		const res = await agent.get("/api/v1/assessment-reports/all").expect(200);
		expect(res.body.success).toBe(true);
	});
});
