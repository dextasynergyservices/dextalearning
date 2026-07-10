import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("LeaderboardController (e2e)", () => {
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
		await request(app.getHttpServer()).get("/api/v1/leaderboard").expect(401);
	});

	it("returns a ranked user board with the caller's position", async () => {
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		await prisma.progressEvent.create({
			data: { userId, entityType: "lesson", eventType: "completed" },
		});

		const res = await agent
			.get("/api/v1/leaderboard?type=overall&period=all_time")
			.expect(200);
		expect(res.body.data.kind).toBe("user");
		expect(res.body.data.entries[0]).toMatchObject({
			subjectId: userId,
			score: 10,
			rank: 1,
			isSelf: true,
		});
		expect(res.body.data.me).toMatchObject({ subjectId: userId, rank: 1 });
	});

	it("supports the group board shape", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		const res = await agent.get("/api/v1/leaderboard?type=group").expect(200);
		expect(res.body.data.kind).toBe("group");
		expect(Array.isArray(res.body.data.entries)).toBe(true);
	});

	it("rejects an unknown leaderboard type", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent.get("/api/v1/leaderboard?type=nonsense").expect(400);
	});
});
