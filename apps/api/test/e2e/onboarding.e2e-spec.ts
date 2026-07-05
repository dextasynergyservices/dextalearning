import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("OnboardingController (e2e)", () => {
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
			.get("/api/v1/onboarding/profile")
			.expect(401);
	});

	it("saves learner onboarding answers and reflects them in the profile", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.post("/api/v1/onboarding/learner")
			.send({ goals: ["career-change"], skillLevel: "beginner" })
			.expect(201);

		const profile = await agent.get("/api/v1/onboarding/profile").expect(200);
		expect(profile.body.data.firstName).toBe("Test");
	});

	it("updates the profile and recomputes the display name", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			firstName: "Ada",
			lastName: "Lovelace",
		});
		const updated = await agent
			.patch("/api/v1/onboarding/profile")
			.send({ firstName: "Grace", lastName: "Hopper" })
			.expect(200);
		expect(updated.body.data).toEqual({ ok: true });

		const profile = await agent.get("/api/v1/onboarding/profile").expect(200);
		expect(profile.body.data.name).toBe("Grace Hopper");
	});
});
