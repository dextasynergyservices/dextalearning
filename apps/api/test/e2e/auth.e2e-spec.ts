import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { buildE2eApp } from "./support/bootstrap";

describe("AuthController (e2e)", () => {
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

	const validPayload = {
		email: "learner@example.com",
		password: "TestPassword123!",
		confirmPassword: "TestPassword123!",
		firstName: "Ada",
		lastName: "Lovelace",
	};

	it("registers a new user and returns the envelope shape", async () => {
		const res = await request(app.getHttpServer())
			.post("/api/v1/auth/register")
			.send(validPayload)
			.expect(201);
		expect(res.body.success).toBe(true);
		expect(res.body.data.email).toBe(validPayload.email);
		expect(res.body.data.emailVerified).toBe(false);
		expect(res.body.data.userId).toBeTruthy();
	});

	it("rejects a duplicate email with 409 EMAIL_EXISTS", async () => {
		await request(app.getHttpServer())
			.post("/api/v1/auth/register")
			.send(validPayload)
			.expect(201);

		const res = await request(app.getHttpServer())
			.post("/api/v1/auth/register")
			.send(validPayload)
			.expect(409);
		expect(res.body.success).toBe(false);
		expect(res.body.error.code).toBe("EMAIL_EXISTS");
	});

	it("rejects a password missing a special character with 400", async () => {
		const res = await request(app.getHttpServer())
			.post("/api/v1/auth/register")
			.send({
				...validPayload,
				password: "TestPassword123",
				confirmPassword: "TestPassword123",
			})
			.expect(400);
		expect(res.body.success).toBe(false);
	});

	it("rejects a mismatched confirmPassword with 400", async () => {
		const res = await request(app.getHttpServer())
			.post("/api/v1/auth/register")
			.send({ ...validPayload, confirmPassword: "SomethingElse123!" })
			.expect(400);
		expect(res.body.success).toBe(false);
	});
});
