import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

async function loginAsAdmin(
	app: NestExpressApplication,
	prisma: PrismaService,
) {
	const { agent, userId } = await registerAndLogin(app, prisma, {
		role: "learner",
	});
	await prisma.user.update({ where: { id: userId }, data: { role: "admin" } });
	return agent;
}

describe("BlogController (e2e)", () => {
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
		await request(app.getHttpServer()).get("/api/v1/blog").expect(401);
	});

	it("403s for a non-admin instructor", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		await agent.get("/api/v1/blog").expect(403);
	});

	it("creates, updates (body -> readMinutes) and publishes a post as admin", async () => {
		const admin = await loginAsAdmin(app, prisma);
		const created = await admin
			.post("/api/v1/blog")
			.send({ title: "Announcing Something" })
			.expect(201);
		expect(created.body.data.status).toBe("draft");

		const updated = await admin
			.patch(`/api/v1/blog/${created.body.data.id}`)
			.send({ bodyHtml: "<p>Real content.</p>" })
			.expect(200);
		expect(updated.body.data.readMinutes).toBe(1);

		const published = await admin
			.post(`/api/v1/blog/${created.body.data.id}/publish`)
			.expect(201);
		expect(published.body.data.status).toBe("published");
	});

	it("rejects publishing an empty post (422)", async () => {
		const admin = await loginAsAdmin(app, prisma);
		const created = await admin
			.post("/api/v1/blog")
			.send({ title: "Empty" })
			.expect(201);
		await admin
			.post(`/api/v1/blog/${created.body.data.id}/publish`)
			.expect(422);
	});
});
