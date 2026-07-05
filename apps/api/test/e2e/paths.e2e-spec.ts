import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { createCourse } from "../integration/support/factories";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("PathsController (e2e)", () => {
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
		await request(app.getHttpServer()).get("/api/v1/paths/mine").expect(401);
	});

	it("creates a path as an instructor and lists it under 'mine'", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const created = await agent
			.post("/api/v1/paths")
			.send({ title: "Real Path" })
			.expect(201);
		expect(created.body.data.status).toBe("draft");

		const mine = await agent.get("/api/v1/paths/mine").expect(200);
		expect(mine.body.data.map((p: { id: string }) => p.id)).toContain(
			created.body.data.id,
		);
	});

	it("forbids a non-owner instructor from editing another instructor's path", async () => {
		const { agent: ownerAgent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const created = await ownerAgent
			.post("/api/v1/paths")
			.send({ title: "Private Path" })
			.expect(201);

		const { agent: otherAgent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		await otherAgent.get(`/api/v1/paths/${created.body.data.id}`).expect(403);
	});

	it("rejects publishing a path with no courses (422)", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const created = await agent
			.post("/api/v1/paths")
			.send({ title: "Empty Path" })
			.expect(201);
		await agent
			.post(`/api/v1/paths/${created.body.data.id}/publish`)
			.expect(422);
	});

	it("publishes once a course is attached", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const created = await agent
			.post("/api/v1/paths")
			.send({ title: "Ready Path" })
			.expect(201);
		const course = await createCourse(prisma);
		await agent
			.post(`/api/v1/paths/${created.body.data.id}/courses`)
			.send({ courseId: course.id })
			.expect(201);
		const published = await agent
			.post(`/api/v1/paths/${created.body.data.id}/publish`)
			.expect(201);
		expect(published.body.data.status).toBe("published");
	});
});
