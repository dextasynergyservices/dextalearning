import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("PhoneVerificationController (e2e)", () => {
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
			.post("/api/v1/phone-verification/send")
			.expect(401);
	});

	it("422s when no phone number is on file", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		const res = await agent
			.post("/api/v1/phone-verification/send")
			.send({})
			.expect(422);
		expect(res.body.error.code).toBe("PHONE_REQUIRED");
	});

	it("sends a code for a phone on file and records the challenge", async () => {
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		await prisma.user.update({
			where: { id: userId },
			data: { phone: "+2348001234567" },
		});

		const res = await agent
			.post("/api/v1/phone-verification/send")
			.send({ channel: "sms" })
			.expect(201);
		expect(res.body.data).toMatchObject({ status: "sent", channel: "sms" });

		const challenge = await prisma.phoneVerification.findUnique({
			where: { userId },
		});
		expect(challenge).not.toBeNull();
	});

	it("rejects a malformed code at the validation pipe", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.post("/api/v1/phone-verification/verify")
			.send({ code: "abc" })
			.expect(400);
	});

	it("422s when verifying with no active challenge", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		const res = await agent
			.post("/api/v1/phone-verification/verify")
			.send({ code: "000000" })
			.expect(422);
		expect(res.body.error.code).toBe("NO_ACTIVE_CODE");
	});
});
