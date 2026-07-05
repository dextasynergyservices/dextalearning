import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("AuthoringController (e2e)", () => {
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
			.post("/api/v1/courses")
			.send({ title: "New Course" })
			.expect(401);
	});

	it("403s for a learner (Roles allows only instructor|admin)", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.post("/api/v1/courses")
			.send({ title: "New Course" })
			.expect(403);
	});

	it("400s on an invalid DTO (title below the 3-char minimum)", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const res = await agent
			.post("/api/v1/courses")
			.send({ title: "ab" })
			.expect(400);
		expect(res.body.success).toBe(false);
	});

	it("creates a course as an instructor, then lists it under 'mine'", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const created = await agent
			.post("/api/v1/courses")
			.send({ title: "Real Course" })
			.expect(201);
		expect(created.body.data.status).toBe("draft");
		expect(created.body.data.title).toBe("Real Course");

		const mine = await agent.get("/api/v1/courses/mine").expect(200);
		expect(mine.body.data.map((c: { id: string }) => c.id)).toContain(
			created.body.data.id,
		);
	});

	it("builds a module + lesson through nested routes", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const course = await agent
			.post("/api/v1/courses")
			.send({ title: "Structured Course" })
			.expect(201);
		const courseId = course.body.data.id;

		const mod = await agent
			.post(`/api/v1/courses/${courseId}/modules`)
			.send({ title: "Module 1" })
			.expect(201);
		expect(mod.body.data.orderIndex).toBe(1);

		const lesson = await agent
			.post(`/api/v1/modules/${mod.body.data.id}/lessons`)
			.send({ title: "Lesson 1", contentType: "text" })
			.expect(201);
		expect(lesson.body.data.orderIndex).toBe(1);
	});
});
