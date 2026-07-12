import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("SimplifierController (e2e)", () => {
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

	async function makeLesson(data: {
		contentText?: string | null;
		transcriptText?: string | null;
	}) {
		const course = await prisma.course.create({
			data: { title: "Course", slug: `c-${Date.now()}`, status: "published" },
		});
		const mod = await prisma.module.create({
			data: { courseId: course.id, title: "M", orderIndex: 1 },
		});
		const lesson = await prisma.lesson.create({
			data: {
				moduleId: mod.id,
				title: "Lesson",
				orderIndex: 1,
				contentType: "text",
				...data,
			},
		});
		return lesson.id;
	}

	it("401s without a session", async () => {
		const lessonId = await makeLesson({ contentText: "<p>Some content.</p>" });
		await request(app.getHttpServer())
			.post(`/api/v1/lessons/${lessonId}/simplify`)
			.expect(401);
	});

	it("returns a simplified version for a signed-in learner", async () => {
		const lessonId = await makeLesson({
			contentText: "<p>Photosynthesis converts light into energy.</p>",
		});
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });

		const res = await agent
			.post(`/api/v1/lessons/${lessonId}/simplify`)
			.expect(201);

		expect(typeof res.body.data.simplified).toBe("string");
		expect(res.body.data.simplified.length).toBeGreaterThan(0);
	});

	it("422s when the lesson has no text", async () => {
		const lessonId = await makeLesson({
			contentText: null,
			transcriptText: null,
		});
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent.post(`/api/v1/lessons/${lessonId}/simplify`).expect(422);
	});
});
