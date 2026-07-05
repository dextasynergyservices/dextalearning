import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { createCourse } from "../integration/support/factories";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("EnrollmentController (e2e)", () => {
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

	it("rejects an unauthenticated request with 401", async () => {
		const course = await createCourse(prisma, { status: "published" });
		const res = await request(app.getHttpServer())
			.get(`/api/v1/enrollments/course/${course.id}`)
			.expect(401);
		expect(res.body.success).toBe(false);
	});

	it("reports not-enrolled, then enrolls, for a real authenticated session", async () => {
		const course = await createCourse(prisma, { status: "published" });
		const { agent } = await registerAndLogin(app, prisma);

		const before = await agent
			.get(`/api/v1/enrollments/course/${course.id}`)
			.expect(200);
		expect(before.body.data.enrolled).toBe(false);

		const enrollRes = await agent
			.post(`/api/v1/enrollments/course/${course.id}`)
			.expect(201);
		expect(enrollRes.body.data.enrolled).toBe(true);

		const after = await agent
			.get(`/api/v1/enrollments/course/${course.id}`)
			.expect(200);
		expect(after.body.data.enrolled).toBe(true);
	});
});
