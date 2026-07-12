import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("CoachController (e2e)", () => {
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

	it("401s on latest without a session", async () => {
		await request(app.getHttpServer()).get("/api/v1/coach/latest").expect(401);
	});

	it("403s a non-admin trying to run the sweep", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent.post("/api/v1/coach/run").expect(403);
	});

	it("returns null when the learner has no digest yet", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		const res = await agent.get("/api/v1/coach/latest").expect(200);
		expect(res.body.data).toBeNull();
	});

	it("admin sweep composes a digest the learner can then read", async () => {
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		// Seed a week's activity for the learner.
		await prisma.progressEvent.createMany({
			data: [
				{ userId, entityType: "lesson", eventType: "completed" },
				{ userId, entityType: "lesson", eventType: "completed" },
			],
		});

		// Promote to admin and run the sweep.
		await prisma.user.update({
			where: { id: userId },
			data: { role: "admin" },
		});
		const run = await agent.post("/api/v1/coach/run").expect(201);
		expect(run.body.data.sent).toBeGreaterThanOrEqual(1);

		const latest = await agent.get("/api/v1/coach/latest").expect(200);
		expect(typeof latest.body.data.headline).toBe("string");
		expect(latest.body.data.headline.length).toBeGreaterThan(0);
		expect(latest.body.data.weekOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});
