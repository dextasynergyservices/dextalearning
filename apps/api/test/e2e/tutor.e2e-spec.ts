import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("TutorController (e2e)", () => {
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

	async function makeLesson(transcriptText: string | null) {
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
				contentType: "video",
				...(transcriptText ? { transcriptText } : {}),
			},
		});
		return lesson.id;
	}

	it("401s without a session", async () => {
		const lessonId = await makeLesson("Some transcript.");
		await request(app.getHttpServer())
			.post(`/api/v1/lessons/${lessonId}/tutor`)
			.send({ question: "Hi?" })
			.expect(401);
	});

	it("answers a signed-in learner's question grounded in the transcript", async () => {
		const lessonId = await makeLesson("The mitochondria is the powerhouse.");
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });

		const res = await agent
			.post(`/api/v1/lessons/${lessonId}/tutor`)
			.send({ question: "What is the mitochondria?" })
			.expect(201);

		expect(res.body.data.grounded).toBe(true);
		expect(typeof res.body.data.answer).toBe("string");
		expect(res.body.data.answer.length).toBeGreaterThan(0);
	});

	it("422s when the lesson has no transcript", async () => {
		const lessonId = await makeLesson(null);
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.post(`/api/v1/lessons/${lessonId}/tutor`)
			.send({ question: "Anything?" })
			.expect(422);
	});

	it("streams an answer over the /tutor/stream endpoint", async () => {
		const lessonId = await makeLesson("Photosynthesis converts light.");
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });

		const res = await agent
			.post(`/api/v1/lessons/${lessonId}/tutor/stream`)
			.send({ question: "How does photosynthesis work?" })
			.expect(200);

		expect(res.headers["content-type"]).toContain("text/plain");
		expect(res.text).toContain("How does photosynthesis work?");
	});

	it("401s on the stream endpoint without a session", async () => {
		const lessonId = await makeLesson("t");
		await request(app.getHttpServer())
			.post(`/api/v1/lessons/${lessonId}/tutor/stream`)
			.send({ question: "Hi?" })
			.expect(401);
	});

	it("400s an empty question (validation)", async () => {
		const lessonId = await makeLesson("Transcript.");
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.post(`/api/v1/lessons/${lessonId}/tutor`)
			.send({ question: "" })
			.expect(400);
	});
});
