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

describe("EngagementController (e2e)", () => {
	let app: NestExpressApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		({ app, prisma } = await buildE2eApp());
	});

	/**
	 * Event handlers run fire-and-forget on the emitter's request path (§6.4)
	 * — badge awards land moments AFTER the progress POST returns. Poll /me
	 * until the expected badges appear instead of asserting immediately.
	 */
	async function waitForBadges(
		agent: ReturnType<typeof request.agent>,
		keys: string[],
	): Promise<void> {
		for (let i = 0; i < 20; i++) {
			const me = await agent.get("/api/v1/engagement/me").expect(200);
			const held: string[] = me.body.data.badges.map(
				(b: { key: string }) => b.key,
			);
			if (keys.every((key) => held.includes(key))) return;
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		throw new Error(`Badges [${keys.join(", ")}] never arrived`);
	}

	beforeEach(async () => {
		await resetDatabase(prisma);
	});

	afterAll(async () => {
		await app.close();
	});

	it("401s /engagement/me without a session", async () => {
		await request(app.getHttpServer()).get("/api/v1/engagement/me").expect(401);
	});

	it("completing a lesson through the real HTTP flow advances the streak and awards first_lesson", async () => {
		const course = await createCourse(prisma);
		const mod = await createModule(prisma, course.id);
		const lesson = await createLesson(prisma, mod.id, { contentType: "video" });
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });

		// Fresh account: zero streak, no badges.
		const before = await agent.get("/api/v1/engagement/me").expect(200);
		expect(before.body.data.streak.current).toBe(0);
		expect(before.body.data.badges).toEqual([]);

		// The real emit→@OnEvent wiring: progress report → completion flip →
		// LessonCompleted → Engagement handler.
		await agent
			.post(`/api/v1/completion/lessons/${lesson.id}/progress`)
			.send({ videoWatchedPct: 100 })
			.expect(201);

		// Single-lesson course completed too → first_course from EntityCompleted.
		await waitForBadges(agent, ["first_lesson", "first_course"]);
		const after = await agent.get("/api/v1/engagement/me").expect(200);
		expect(after.body.data.streak.current).toBe(1);
		expect(after.body.data.streak.todayDone).toBe(true);
		expect(after.body.data.unseenBadgeKeys).toContain("first_lesson");
		expect(after.body.data.unseenBadgeKeys).toContain("first_course");
	});

	it("marks badges seen so celebrations show only once", async () => {
		const course = await createCourse(prisma);
		const mod = await createModule(prisma, course.id);
		const lesson = await createLesson(prisma, mod.id, { contentType: "video" });
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.post(`/api/v1/completion/lessons/${lesson.id}/progress`)
			.send({ videoWatchedPct: 100 })
			.expect(201);
		await waitForBadges(agent, ["first_lesson", "first_course"]);

		await agent
			.post("/api/v1/engagement/badges/seen")
			.send({ keys: ["first_lesson", "first_course"] })
			.expect(201);

		const me = await agent.get("/api/v1/engagement/me").expect(200);
		expect(me.body.data.unseenBadgeKeys).toEqual([]);
	});

	it("social-proof is public and reports completions this week", async () => {
		const course = await createCourse(prisma);
		const mod = await createModule(prisma, course.id);
		const lesson = await createLesson(prisma, mod.id, { contentType: "video" });
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent
			.post(`/api/v1/completion/lessons/${lesson.id}/progress`)
			.send({ videoWatchedPct: 100 })
			.expect(201);

		// No session required — the course detail page is public.
		const proof = await request(app.getHttpServer())
			.get(`/api/v1/engagement/social-proof?courseId=${course.id}`)
			.expect(200);
		expect(proof.body.data.completedThisWeek).toBe(1);
	});
});
