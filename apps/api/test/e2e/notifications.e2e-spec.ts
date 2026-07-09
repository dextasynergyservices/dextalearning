import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NotificationsService } from "../../src/modules/notifications/notifications.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

describe("NotificationsController (e2e)", () => {
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
		await request(app.getHttpServer()).get("/api/v1/notifications").expect(401);
	});

	it("lists, reads one, and reads all through the real HTTP stack", async () => {
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "learner",
		});
		const notifications = app.get(NotificationsService);
		await notifications.notify(userId, {
			type: "reminder_digest",
			dataJson: { reviewCount: 1 },
			inApp: true,
		});
		await notifications.notify(userId, { type: "badge_awarded", inApp: true });

		const list = await agent.get("/api/v1/notifications").expect(200);
		expect(list.body.data.notifications).toHaveLength(2);
		expect(list.body.data.unreadCount).toBe(2);

		const first = list.body.data.notifications[0];
		await agent.post(`/api/v1/notifications/${first.id}/read`).expect(201);
		const afterOne = await agent.get("/api/v1/notifications").expect(200);
		expect(afterOne.body.data.unreadCount).toBe(1);

		await agent.post("/api/v1/notifications/read-all").expect(201);
		const afterAllRead = await agent.get("/api/v1/notifications").expect(200);
		expect(afterAllRead.body.data.unreadCount).toBe(0);
	});
});
