import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("TranslationController (e2e)", () => {
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
			.post("/api/v1/i18n/translate")
			.send({ texts: ["Hello"], language: "fr" })
			.expect(401);
	});

	it("400s on an invalid language", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		const res = await agent
			.post("/api/v1/i18n/translate")
			.send({ texts: ["Hello"], language: "de" })
			.expect(400);
		expect(res.body.success).toBe(false);
	});

	it("translates for an authenticated user (via the fake AI adapter)", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		const res = await agent
			.post("/api/v1/i18n/translate")
			.send({ texts: ["Hello"], language: "fr" })
			.expect(201);
		expect(res.body.data.translations).toEqual(["Hello"]);
	});
});
