import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import {
	createCourse,
	createLesson,
	createModule,
} from "../integration/support/factories";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("CompletionController (e2e)", () => {
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
			.get("/api/v1/completion/mine")
			.expect(401);
	});

	it("records lesson progress and reflects it in course progress", async () => {
		const course = await createCourse(prisma);
		const mod = await createModule(prisma, course.id);
		const lesson = await createLesson(prisma, mod.id, { contentType: "video" });
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });

		const progress = await agent
			.post(`/api/v1/completion/lessons/${lesson.id}/progress`)
			.send({ videoWatchedPct: 90 })
			.expect(201);
		expect(progress.body.data.done).toBe(true);

		const course_ = await agent
			.get(`/api/v1/completion/courses/${course.id}`)
			.expect(200);
		expect(course_.body.data.summary.isComplete).toBe(true);

		const mine = await agent.get("/api/v1/completion/mine").expect(200);
		expect(mine.body.data.courses.map((c: { id: string }) => c.id)).toContain(
			course.id,
		);
	});
});
