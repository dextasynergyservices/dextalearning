import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("ChatController (e2e)", () => {
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

	async function makeGroup() {
		const cohort = await prisma.cohort.create({
			data: { title: "Chat Cohort", slug: `chat-${Date.now()}` },
		});
		const group = await prisma.group.create({
			data: { cohortId: cohort.id, name: "Alpha" },
		});
		return { cohortId: cohort.id, groupId: group.id };
	}

	it("401s without a session", async () => {
		await request(app.getHttpServer()).get("/api/v1/groups/mine").expect(401);
	});

	it("serves history + info to a member and lists their groups", async () => {
		const { cohortId, groupId } = await makeGroup();
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		await prisma.groupMember.create({ data: { groupId, userId } });
		await prisma.groupMessage.create({
			data: { groupId, userId, content: "hello team" },
		});

		const history = await agent
			.get(`/api/v1/groups/${groupId}/messages`)
			.expect(200);
		expect(history.body.data.messages[0]).toMatchObject({
			content: "hello team",
			userId,
		});

		const info = await agent.get(`/api/v1/groups/${groupId}`).expect(200);
		expect(info.body.data.name).toBe("Alpha");
		expect(info.body.data.members).toHaveLength(1);

		const mine = await agent.get("/api/v1/groups/mine").expect(200);
		expect(mine.body.data).toHaveLength(1);

		const inCohort = await agent
			.get(`/api/v1/groups/in-cohort/${cohortId}`)
			.expect(200);
		expect(inCohort.body.data.id).toBe(groupId);
	});

	it("403s a non-member asking for a group's history", async () => {
		const { groupId } = await makeGroup();
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent.get(`/api/v1/groups/${groupId}/messages`).expect(403);
	});
});
