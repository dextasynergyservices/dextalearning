import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("PacingController (e2e)", () => {
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
		await request(app.getHttpServer()).get("/api/v1/pacing/me").expect(401);
	});

	it("returns a pacing signal for a signed-in learner", async () => {
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		await prisma.user.update({
			where: { id: userId },
			data: { weeklyHours: "low" },
		});
		await prisma.progressEvent.createMany({
			data: [
				{ userId, entityType: "lesson", eventType: "completed" },
				{ userId, entityType: "lesson", eventType: "completed" },
				{ userId, entityType: "lesson", eventType: "completed" },
			],
		});

		const res = await agent.get("/api/v1/pacing/me").expect(200);
		expect(res.body.data.state).toBe("ahead");
		expect(res.body.data.targetPerWeek).toBe(3);
		expect(res.body.data.lessonsThisWeek).toBe(3);
	});
});
