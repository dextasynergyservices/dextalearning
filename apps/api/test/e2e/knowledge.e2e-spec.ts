import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("KnowledgeController (e2e)", () => {
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

	async function seedCourseWithLesson(transcriptText: string) {
		const course = await prisma.course.create({
			data: { title: "Course", slug: `c-${Date.now()}`, status: "published" },
		});
		const mod = await prisma.module.create({
			data: { courseId: course.id, title: "M", orderIndex: 1 },
		});
		await prisma.lesson.create({
			data: {
				moduleId: mod.id,
				title: "Recursion basics",
				orderIndex: 1,
				contentType: "video",
				transcriptText,
			},
		});
		return course.id;
	}

	it("401s on search without a session", async () => {
		const courseId = await seedCourseWithLesson("Some transcript.");
		await request(app.getHttpServer())
			.get(`/api/v1/courses/${courseId}/search?q=recursion`)
			.expect(401);
	});

	it("401s on path + cohort search without a session", async () => {
		await request(app.getHttpServer())
			.get("/api/v1/paths/00000000-0000-0000-0000-000000000000/search?q=x")
			.expect(401);
		await request(app.getHttpServer())
			.get("/api/v1/cohorts/00000000-0000-0000-0000-000000000000/search?q=x")
			.expect(401);
	});

	it("403s a non-admin trying to reindex", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent.post("/api/v1/admin/knowledge/reindex").expect(403);
	});

	it("indexes transcripts (admin backfill) and finds them via search", async () => {
		const text =
			"Recursion is a function that calls itself to solve a problem.";
		const courseId = await seedCourseWithLesson(text);

		// Promote a user to admin and run the backfill.
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		await prisma.user.update({
			where: { id: userId },
			data: { role: "admin" },
		});
		const reindex = await agent
			.post("/api/v1/admin/knowledge/reindex")
			.expect(201);
		expect(reindex.body.data.lessons).toBeGreaterThanOrEqual(1);

		// Now search finds the indexed lesson.
		const res = await agent
			.get(`/api/v1/courses/${courseId}/search?q=${encodeURIComponent(text)}`)
			.expect(200);
		expect(res.body.data[0].lessonTitle).toBe("Recursion basics");
		expect(typeof res.body.data[0].snippet).toBe("string");
	});

	it("returns an empty list for a blank query", async () => {
		const courseId = await seedCourseWithLesson("Some transcript.");
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		const res = await agent
			.get(`/api/v1/courses/${courseId}/search?q=`)
			.expect(200);
		expect(res.body.data).toEqual([]);
	});
});
