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

	it("saves reminder settings and rejects an unknown studySchedule (Phase 4, §3.2)", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.patch("/api/v1/onboarding/profile")
			.send({ studySchedule: "midnight" })
			.expect(400);
		await agent
			.patch("/api/v1/onboarding/profile")
			.send({ studyAnchor: "after_church" })
			.expect(400);

		await agent
			.patch("/api/v1/onboarding/profile")
			.send({
				whatsappOptIn: true,
				studySchedule: "evening",
				studyAnchor: "after_work",
				weeklyHours: "medium",
				timezone: "Africa/Lagos",
			})
			.expect(200);
		const profile = await agent.get("/api/v1/onboarding/profile").expect(200);
		expect(profile.body.data.whatsappOptIn).toBe(true);
		expect(profile.body.data.studySchedule).toBe("evening");
		expect(profile.body.data.studyAnchor).toBe("after_work");
		expect(profile.body.data.weeklyHours).toBe("medium");
		expect(profile.body.data.timezone).toBe("Africa/Lagos");
	});

	it("treats phone as truly optional — an empty phone saves, a malformed one 400s", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		// Set a phone, then clear it by sending "" — this used to 400 ("Invalid
		// phone number") because @IsOptional doesn't skip empty strings.
		await agent
			.patch("/api/v1/onboarding/profile")
			.send({ phone: "+2348001234567" })
			.expect(200);
		await agent
			.patch("/api/v1/onboarding/profile")
			.send({ phone: "" })
			.expect(200);
		const cleared = await agent.get("/api/v1/onboarding/profile").expect(200);
		expect(cleared.body.data.phone).toBeNull();

		// A genuinely malformed phone is still rejected.
		await agent
			.patch("/api/v1/onboarding/profile")
			.send({ phone: "abc" })
			.expect(400);
	});
});
