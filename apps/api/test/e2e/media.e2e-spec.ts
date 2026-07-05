import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { createLesson, createModule } from "../integration/support/factories";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("MediaController (e2e)", () => {
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

	it("401s an upload without a session", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const course = await agent
			.post("/api/v1/courses")
			.send({ title: "Media course" })
			.expect(201);
		const mod = await agent
			.post(`/api/v1/courses/${course.body.data.id}/modules`)
			.send({ title: "Module" })
			.expect(201);
		const lesson = await agent
			.post(`/api/v1/modules/${mod.body.data.id}/lessons`)
			.send({ title: "Lesson", contentType: "pdf" })
			.expect(201);

		await request(app.getHttpServer())
			.post(`/api/v1/lessons/${lesson.body.data.id}/pdf`)
			.attach("file", Buffer.from("%PDF-1.4"), "doc.pdf")
			.expect(401);
	});

	it("403s an upload from a learner", async () => {
		const mod = await createModule(
			prisma,
			(
				await prisma.course.create({
					data: { title: "C", slug: "media-course-2" },
				})
			).id,
		);
		const lesson = await createLesson(prisma, mod.id);
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.post(`/api/v1/lessons/${lesson.id}/pdf`)
			.attach("file", Buffer.from("%PDF-1.4"), "doc.pdf")
			.expect(403);
	});

	it("uploads a PDF via real multipart/form-data, as the owning instructor", async () => {
		const { agent } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		const course = await agent
			.post("/api/v1/courses")
			.send({ title: "Media course 3" })
			.expect(201);
		const mod = await agent
			.post(`/api/v1/courses/${course.body.data.id}/modules`)
			.send({ title: "Module" })
			.expect(201);
		const lesson = await agent
			.post(`/api/v1/modules/${mod.body.data.id}/lessons`)
			.send({ title: "Lesson", contentType: "pdf" })
			.expect(201);

		const uploaded = await agent
			.post(`/api/v1/lessons/${lesson.body.data.id}/pdf`)
			.attach("file", Buffer.from("%PDF-1.4"), "doc.pdf")
			.expect(201);
		expect(uploaded.body.data.status).toBe("ready");

		const transcript = await agent
			.patch(`/api/v1/lessons/${lesson.body.data.id}/transcript`)
			.send({ text: "Lesson transcript." })
			.expect(200);
		expect(transcript.body.data.id).toBe(lesson.body.data.id);
	});
});
