import { beforeEach, describe, expect, it } from "vitest";
import { EngagementQueryService } from "../../src/modules/engagement/engagement-query.service";
import { localDateOf } from "../../src/modules/engagement/streak.calculator";
import { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { RemindersEventsHandler } from "../../src/modules/reminders/reminders.events-handler";
import { RemindersService } from "../../src/modules/reminders/reminders.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";
import { FakeNotificationAdapter } from "./support/fakes/fake-notification.adapter";

/** 18:00 UTC — the evening send-hour for a UTC-timezone user. */
function eveningUtc(): Date {
	const d = new Date();
	d.setUTCHours(18, 30, 0, 0);
	return d;
}

describe("Reminders context (integration)", () => {
	const prisma = getTestPrisma();
	const port = new FakeNotificationAdapter();
	const notifications = new NotificationsService(prisma, port);
	const engagementQuery = new EngagementQueryService(prisma);
	const service = new RemindersService(prisma, engagementQuery, notifications);
	const handler = new RemindersEventsHandler(prisma);

	let userId: string;

	beforeEach(async () => {
		port.reset();
		const user = await createUser(prisma, { role: "learner" });
		userId = user.id;
		// Deterministic timezone for the send-window math in this suite.
		await prisma.user.update({
			where: { id: userId },
			data: { timezone: "UTC", firstName: "Ada" },
		});
	});

	async function seedReviewItem(overrides: { nextDueOn?: Date } = {}) {
		await prisma.reviewItem.create({
			data: {
				userId,
				lessonId: "11111111-1111-1111-1111-111111111111",
				courseId: "22222222-2222-2222-2222-222222222222",
				lessonTitle: "What is spacing?",
				courseTitle: "Spaced Repetition Basics",
				completedOn: new Date(Date.now() - 2 * 86_400_000),
				intervalIndex: 0,
				nextDueOn: overrides.nextDueOn ?? new Date(Date.now() - 86_400_000),
			},
		});
	}

	it("LessonCompleted seeds a review item due tomorrow — idempotently", async () => {
		const event = {
			userId,
			lessonId: "11111111-1111-1111-1111-111111111111",
			courseId: "22222222-2222-2222-2222-222222222222",
			lessonTitle: "What is spacing?",
			courseTitle: "Spaced Repetition Basics",
			completedAt: new Date().toISOString(),
		};
		await handler.onLessonCompleted(event);
		await handler.onLessonCompleted(event); // ladder must not reset

		const items = await prisma.reviewItem.findMany({ where: { userId } });
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			lessonTitle: "What is spacing?",
			intervalIndex: 0,
			done: false,
		});
		const localToday = localDateOf(new Date(), "UTC");
		const dueOn = items[0].nextDueOn.toISOString().slice(0, 10);
		expect(dueOn > localToday).toBe(true); // strictly tomorrow
	});

	it("sweep in the send window delivers ONE localized digest (in-app + email + WhatsApp) and advances the ladder", async () => {
		await seedReviewItem();
		await prisma.user.update({
			where: { id: userId },
			data: { phone: "+2348000000000", whatsappOptIn: true, language: "pcm" },
		});
		// Streak at risk: last activity yesterday.
		await prisma.userStreak.create({
			data: {
				userId,
				current: 5,
				longest: 5,
				lastActiveDate: new Date(Date.now() - 86_400_000),
			},
		});

		const result = await service.sweep(eveningUtc());
		expect(result.sent).toBe(1);

		// In-app row (§8.6) with the structured payload the bell renders.
		const inApp = await prisma.notification.findMany({ where: { userId } });
		expect(inApp).toHaveLength(1);
		expect(inApp[0].type).toBe("reminder_digest");
		expect(inApp[0].dataJson).toMatchObject({
			streakKind: "at_risk",
			streakCurrent: 5,
			reviewCount: 1,
			recallTitle: "What is spacing?",
		});

		// Email localized to the user's language (pcm), leading with the
		// free-recall challenge (§3.1 testing effect).
		expect(port.emails).toHaveLength(1);
		expect(port.emails[0].subject).toContain("no break your 5-day streak");
		expect(port.emails[0].html).toContain("What is spacing?");
		expect(port.emails[0].html).toContain("wetin be di main idea");

		// WhatsApp: opted in + phone present.
		expect(port.whatsapps).toHaveLength(1);
		expect(port.whatsapps[0].phone).toBe("+2348000000000");

		// The included review advanced to the next rung (1 → 3 days).
		const item = await prisma.reviewItem.findFirstOrThrow({
			where: { userId },
		});
		expect(item.intervalIndex).toBe(1);
		expect(item.done).toBe(false);

		// Dedup log written for today.
		expect(await prisma.reminderLog.count({ where: { userId } })).toBe(1);
	});

	it("a broken streak gets fresh-start framing, and the anchor phrase rides along (§3.1)", async () => {
		await seedReviewItem();
		await prisma.user.update({
			where: { id: userId },
			data: {
				phone: "+2348000000000",
				whatsappOptIn: true,
				studyAnchor: "after_work",
			},
		});
		// Streak BROKE: last activity 2 days ago, but it was a real streak.
		await prisma.userStreak.create({
			data: {
				userId,
				current: 6,
				longest: 6,
				lastActiveDate: new Date(Date.now() - 2 * 86_400_000),
			},
		});

		expect((await service.sweep(eveningUtc())).sent).toBe(1);

		// Fresh start, never loss-rubbing (§3.1 Dai/Milkman/Riis).
		expect(port.emails[0].subject).toContain("Fresh start today");
		expect(port.emails[0].html).toContain("clean slate");
		expect(port.emails[0].html).not.toContain("on the line");
		// Habit anchor referenced in the WhatsApp nudge (§3.1 habit stacking).
		expect(port.whatsapps[0].message).toContain("after work");
		expect(port.whatsapps[0].message).toContain("fresh start");

		const inApp = await prisma.notification.findFirstOrThrow({
			where: { userId },
		});
		expect(inApp.dataJson).toMatchObject({ streakKind: "fresh_start" });
	});

	it("a broken streak alone (no due reviews) never triggers a digest", async () => {
		await prisma.userStreak.create({
			data: {
				userId,
				current: 6,
				longest: 6,
				lastActiveDate: new Date(Date.now() - 2 * 86_400_000),
			},
		});
		expect((await service.sweep(eveningUtc())).sent).toBe(0);
		expect(port.emails).toHaveLength(0);
	});

	it("sends at most one digest per user per local day", async () => {
		await seedReviewItem();
		expect((await service.sweep(eveningUtc())).sent).toBe(1);
		expect((await service.sweep(eveningUtc())).sent).toBe(0);
		expect(port.emails).toHaveLength(1);
	});

	it("skips outside the user's send window (wrong hour)", async () => {
		await seedReviewItem();
		const morning = new Date();
		morning.setUTCHours(9, 0, 0, 0);
		expect((await service.sweep(morning)).sent).toBe(0);
		expect(port.emails).toHaveLength(0);
	});

	it("weekend schedule only sends on Saturday/Sunday", async () => {
		await seedReviewItem();
		await prisma.user.update({
			where: { id: userId },
			data: { studySchedule: "weekend" },
		});
		const now = eveningUtc();
		const isWeekend = [0, 6].includes(now.getUTCDay());
		expect((await service.sweep(now)).sent).toBe(isWeekend ? 1 : 0);
	});

	it("skips WhatsApp without opt-in and skips users with nothing to say", async () => {
		await seedReviewItem();
		await prisma.user.update({
			where: { id: userId },
			data: { phone: "+2348000000000", whatsappOptIn: false },
		});
		expect((await service.sweep(eveningUtc())).sent).toBe(1);
		expect(port.emails).toHaveLength(1);
		expect(port.whatsapps).toHaveLength(0);

		// A second user with no due items and no streak → never a candidate.
		expect((await service.sweep(eveningUtc())).sent).toBe(0);
	});

	it("caps the digest at 3 reviews and leaves the rest due for tomorrow", async () => {
		for (let i = 0; i < 5; i++) {
			await prisma.reviewItem.create({
				data: {
					userId,
					lessonId: `33333333-3333-3333-3333-33333333333${i}`,
					courseId: "22222222-2222-2222-2222-222222222222",
					lessonTitle: `Lesson ${i}`,
					courseTitle: "Course",
					completedOn: new Date(Date.now() - 3 * 86_400_000),
					intervalIndex: 0,
					nextDueOn: new Date(Date.now() - 86_400_000),
				},
			});
		}
		await service.sweep(eveningUtc());
		const advanced = await prisma.reviewItem.count({
			where: { userId, intervalIndex: 1 },
		});
		const stillDue = await prisma.reviewItem.count({
			where: { userId, intervalIndex: 0 },
		});
		expect(advanced).toBe(3);
		expect(stillDue).toBe(2);
	});
});
