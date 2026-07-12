import { beforeEach, describe, expect, it } from "vitest";
import { CoachService } from "../../src/modules/coach/coach.service";
import { EngagementQueryService } from "../../src/modules/engagement/engagement-query.service";
import { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";
import { FakeAiAdapter } from "./support/fakes/fake-ai.adapter";
import { FakeNotificationAdapter } from "./support/fakes/fake-notification.adapter";

describe("Coach context (integration)", () => {
	const prisma = getTestPrisma();
	const port = new FakeNotificationAdapter();
	const notifications = new NotificationsService(prisma, port);
	const engagementQuery = new EngagementQueryService(prisma);
	const ai = new FakeAiAdapter();
	const service = new CoachService(prisma, engagementQuery, notifications, ai);

	let userId: string;

	beforeEach(async () => {
		port.reset();
		const user = await createUser(prisma, { role: "learner" });
		userId = user.id;
		await prisma.user.update({
			where: { id: userId },
			data: { firstName: "Ada", language: "en" },
		});
	});

	async function seedLessonCompleted(count: number) {
		for (let i = 0; i < count; i++) {
			await prisma.progressEvent.create({
				data: { userId, entityType: "lesson", eventType: "completed" },
			});
		}
	}

	async function seedQuiz(passed: boolean, score: number) {
		await prisma.progressEvent.create({
			data: {
				userId,
				entityType: "assessment",
				eventType: "attempt_submitted",
				metadataJson: { passed, score },
			},
		});
	}

	it("composes + stores + delivers a weekly digest for an active learner", async () => {
		await seedLessonCompleted(3);
		await seedQuiz(true, 90);

		const { sent } = await service.sweep();
		expect(sent).toBe(1);

		// Stored digest row.
		const digest = await prisma.coachDigest.findFirst({ where: { userId } });
		expect(digest?.headline).toContain("Ada");
		expect(digest?.body).toContain("3 lesson");

		// In-app + email delivered.
		const inApp = await prisma.notification.findMany({ where: { userId } });
		expect(inApp).toHaveLength(1);
		expect(inApp[0].type).toBe("coach_digest");
		expect(port.emails).toHaveLength(1);
		expect(port.emails[0].subject).toContain("weekly learning check-in");
	});

	it("sends at most one digest per user per week (dedup)", async () => {
		await seedLessonCompleted(2);

		expect((await service.sweep()).sent).toBe(1);
		port.reset();
		expect((await service.sweep()).sent).toBe(0);
		expect(port.emails).toHaveLength(0);
		expect(await prisma.coachDigest.count({ where: { userId } })).toBe(1);
	});

	it("skips learners with no meaningful activity this week", async () => {
		// Only an enrollment event — not a learning action.
		await prisma.progressEvent.create({
			data: { userId, entityType: "course", eventType: "enrolled" },
		});
		expect((await service.sweep()).sent).toBe(0);
		expect(port.emails).toHaveLength(0);
	});

	it("ignores activity older than a week", async () => {
		await prisma.progressEvent.create({
			data: {
				userId,
				entityType: "lesson",
				eventType: "completed",
				createdAt: new Date(Date.now() - 10 * 86_400_000),
			},
		});
		expect((await service.sweep()).sent).toBe(0);
	});

	it("sends WhatsApp only when opted in with a phone", async () => {
		await prisma.user.update({
			where: { id: userId },
			data: { phone: "+2348000000000", whatsappOptIn: true },
		});
		await seedLessonCompleted(1);

		await service.sweep();
		expect(port.whatsapps).toHaveLength(1);
		expect(port.whatsapps[0].phone).toBe("+2348000000000");
	});

	it("latestFor returns the most recent composed digest", async () => {
		await seedLessonCompleted(1);
		await service.sweep();
		const latest = await service.latestFor(userId);
		expect(latest?.headline).toContain("Ada");
		expect(latest?.action).toBeTruthy();
	});
});
