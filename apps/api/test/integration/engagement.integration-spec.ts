import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { EngagementEventsHandler } from "../../src/modules/engagement/engagement.events-handler";
import { EngagementService } from "../../src/modules/engagement/engagement.service";
import { EngagementQueryService } from "../../src/modules/engagement/engagement-query.service";
import { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { getTestPrisma } from "./support/db";
import { createCourse, createUser } from "./support/factories";
import { FakeNotificationAdapter } from "./support/fakes/fake-notification.adapter";

function asAuthenticatedUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "learner" };
}

/**
 * The handler methods ARE the subscription surface (@OnEvent binds them when
 * Nest bootstraps) — integration tests invoke them directly against the real
 * test DB, mirroring how other specs construct services without the DI graph.
 * The emit→handler wiring itself is covered by the e2e suite.
 */
describe("Engagement context (integration)", () => {
	const prisma = getTestPrisma();
	const notifications = new NotificationsService(
		prisma,
		new FakeNotificationAdapter(),
	);
	const handler = new EngagementEventsHandler(prisma, notifications);
	const service = new EngagementService(prisma);
	const query = new EngagementQueryService(prisma);

	let learnerId: string;

	beforeEach(async () => {
		learnerId = (await createUser(prisma, { role: "learner" })).id;
	});

	async function completeLesson(
		lessonId = "11111111-1111-1111-1111-111111111111",
	) {
		await handler.onLessonCompleted({
			userId: learnerId,
			lessonId,
			courseId: "22222222-2222-2222-2222-222222222222",
			lessonTitle: "Lesson",
			courseTitle: "Course",
			completedAt: new Date().toISOString(),
		});
	}

	it("LessonCompleted records a progress event, starts the streak, and awards first_lesson", async () => {
		await completeLesson();

		const events = await prisma.progressEvent.findMany({
			where: { userId: learnerId },
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			entityType: "lesson",
			eventType: "completed",
		});

		const streak = await prisma.userStreak.findUnique({
			where: { userId: learnerId },
		});
		expect(streak?.current).toBe(1);
		expect(streak?.longest).toBe(1);

		const badges = await prisma.userBadge.findMany({
			where: { userId: learnerId },
		});
		expect(badges.map((b) => b.badgeKey)).toEqual(["first_lesson"]);
		expect(badges[0].seenAt).toBeNull();
	});

	it("a new badge writes ONE badge_awarded in-app notification, re-awards none (§8.6)", async () => {
		await completeLesson();
		await completeLesson();

		const rows = await prisma.notification.findMany({
			where: { userId: learnerId, type: "badge_awarded" },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0].dataJson).toMatchObject({ badgeKey: "first_lesson" });
	});

	it("same-day duplicate events keep the streak at 1 and never re-award badges", async () => {
		await completeLesson();
		await completeLesson();

		const streak = await prisma.userStreak.findUnique({
			where: { userId: learnerId },
		});
		expect(streak?.current).toBe(1);

		const badges = await prisma.userBadge.findMany({
			where: { userId: learnerId, badgeKey: "first_lesson" },
		});
		expect(badges).toHaveLength(1);
	});

	it("surviving a missed day via a freeze awards the comeback badge (§3.2)", async () => {
		// Streak alive but idle since 2 days ago, with a freeze banked.
		await prisma.userStreak.create({
			data: {
				userId: learnerId,
				current: 5,
				longest: 5,
				freezes: 1,
				lastActiveDate: new Date(Date.now() - 2 * 86_400_000),
			},
		});
		await completeLesson();

		const streak = await prisma.userStreak.findUniqueOrThrow({
			where: { userId: learnerId },
		});
		expect(streak.current).toBe(6); // freeze bridged the gap
		expect(streak.freezes).toBe(0);

		const keys = (
			await prisma.userBadge.findMany({ where: { userId: learnerId } })
		).map((b) => b.badgeKey);
		expect(keys).toContain("comeback");
	});

	it("getMe surfaces the nearest locked badge for the goal-gradient nudge (§3.2)", async () => {
		await completeLesson();
		const me = await service.getMe(asAuthenticatedUser(learnerId));

		// first_lesson + streak_3-adjacent state: 1 lesson done, streak 1 →
		// nearest rung is first_quiz_pass (1 away) or first_course (1 away);
		// the tie-break picks the smaller target first in ladder terms — both
		// are target 1, so assert the shape + a sane candidate instead of a
		// specific key.
		expect(me.nextBadge).not.toBeNull();
		expect(me.nextBadge?.target).toBeGreaterThan(me.nextBadge?.current ?? 0);
		expect(me.allBadgeKeys).toContain(me.nextBadge?.key);
	});

	it("a perfect passed quiz awards first_quiz_pass + perfect_quiz", async () => {
		await handler.onAttemptSubmitted({
			userId: learnerId,
			assessmentId: "33333333-3333-3333-3333-333333333333",
			lessonId: null,
			scope: "course_final",
			score: 100,
			passed: true,
			attemptNumber: 1,
		});

		const keys = (
			await prisma.userBadge.findMany({ where: { userId: learnerId } })
		).map((b) => b.badgeKey);
		expect(keys).toContain("first_quiz_pass");
		expect(keys).toContain("perfect_quiz");
	});

	it("growth_leap: a post-quiz beating the pre-quiz by ≥25 points", async () => {
		const lessonId = "44444444-4444-4444-4444-444444444444";
		await handler.onAttemptSubmitted({
			userId: learnerId,
			assessmentId: "55555555-5555-5555-5555-555555555555",
			lessonId,
			scope: "lesson_pre",
			score: 40,
			passed: false,
			attemptNumber: 1,
		});
		await handler.onAttemptSubmitted({
			userId: learnerId,
			assessmentId: "66666666-6666-6666-6666-666666666666",
			lessonId,
			scope: "lesson_post",
			score: 80,
			passed: true,
			attemptNumber: 1,
		});

		const keys = (
			await prisma.userBadge.findMany({ where: { userId: learnerId } })
		).map((b) => b.badgeKey);
		expect(keys).toContain("growth_leap");
	});

	it("no growth_leap without a prior pre-quiz event or below the delta", async () => {
		await handler.onAttemptSubmitted({
			userId: learnerId,
			assessmentId: "66666666-6666-6666-6666-666666666666",
			lessonId: "44444444-4444-4444-4444-444444444444",
			scope: "lesson_post",
			score: 100,
			passed: true,
			attemptNumber: 1,
		});
		const keys = (
			await prisma.userBadge.findMany({ where: { userId: learnerId } })
		).map((b) => b.badgeKey);
		expect(keys).not.toContain("growth_leap");
	});

	it("EntityCompleted(course) awards first_course but never touches the streak", async () => {
		await handler.onEntityCompleted({
			userId: learnerId,
			entityType: "course",
			entityId: "22222222-2222-2222-2222-222222222222",
			completedAt: new Date().toISOString(),
		});

		const keys = (
			await prisma.userBadge.findMany({ where: { userId: learnerId } })
		).map((b) => b.badgeKey);
		expect(keys).toContain("first_course");
		expect(
			await prisma.userStreak.findUnique({ where: { userId: learnerId } }),
		).toBeNull();
	});

	it("getMe returns the streak, a 7-day activity strip, and unseen badges; markBadgesSeen clears them", async () => {
		await completeLesson();
		const me = await service.getMe(asAuthenticatedUser(learnerId));

		expect(me.streak).toMatchObject({
			current: 1,
			longest: 1,
			freezes: 0,
			todayDone: true,
			atRisk: false,
		});
		expect(me.weekActivity).toHaveLength(7);
		expect(me.weekActivity[6].active).toBe(true); // today, rightmost
		expect(me.unseenBadgeKeys).toContain("first_lesson");
		expect(me.allBadgeKeys).toContain("streak_7");

		await service.markBadgesSeen(asAuthenticatedUser(learnerId), [
			"first_lesson",
		]);
		const after = await service.getMe(asAuthenticatedUser(learnerId));
		expect(after.unseenBadgeKeys).toEqual([]);
		expect(after.badges[0].seen).toBe(true);
	});

	it("social proof counts distinct completers within 7 days only", async () => {
		const course = await createCourse(prisma);
		const other = await createUser(prisma, { role: "learner" });

		for (const uid of [learnerId, other.id]) {
			await handler.onEntityCompleted({
				userId: uid,
				entityType: "course",
				entityId: course.id,
				completedAt: new Date().toISOString(),
			});
		}
		// A stale completion outside the window must not count.
		const stale = await createUser(prisma, { role: "learner" });
		await prisma.progressEvent.create({
			data: {
				userId: stale.id,
				entityType: "course",
				entityId: course.id,
				eventType: "completed",
				createdAt: new Date(Date.now() - 10 * 86_400_000),
			},
		});

		const proof = await service.getSocialProof(course.id);
		expect(proof.completedThisWeek).toBe(2);
	});

	it("listStreaksAtRisk over-fetches recent streaks for the reminder sweep", async () => {
		await prisma.userStreak.create({
			data: {
				userId: learnerId,
				current: 4,
				longest: 4,
				lastActiveDate: new Date(Date.now() - 86_400_000),
			},
		});
		const atRisk = await query.listStreaksAtRisk();
		expect(atRisk.some((r) => r.userId === learnerId && r.current === 4)).toBe(
			true,
		);
	});

	it("subscriber failures are swallowed, never rethrown into the emitter", async () => {
		// Bogus user id violates the FK — the handler must log, not throw.
		await expect(
			handler.onLessonCompleted({
				userId: "99999999-9999-9999-9999-999999999999",
				lessonId: "11111111-1111-1111-1111-111111111111",
				courseId: "22222222-2222-2222-2222-222222222222",
				lessonTitle: "L",
				courseTitle: "C",
				completedAt: new Date().toISOString(),
			}),
		).resolves.toBeUndefined();
	});
});
