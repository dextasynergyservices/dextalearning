import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("SubmissionsController (e2e)", () => {
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
		const project = await prisma.project.create({
			data: { scope: "course", title: "Anon check", orderIndex: 1 },
		});
		await request(app.getHttpServer())
			.get(`/api/v1/projects/${project.id}/info`)
			.expect(401);
	});

	it("submits and re-reads the learner's own submission", async () => {
		const project = await prisma.project.create({
			data: { scope: "course", title: "Submit me", orderIndex: 1 },
		});
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });

		const submitted = await agent
			.post(`/api/v1/projects/${project.id}/submit`)
			.send({ textContent: "My work" })
			.expect(201);
		expect(submitted.body.data.textContent).toBe("My work");

		const info = await agent
			.get(`/api/v1/projects/${project.id}/info`)
			.expect(200);
		expect(info.body.data.mySubmission.textContent).toBe("My work");
	});
});
