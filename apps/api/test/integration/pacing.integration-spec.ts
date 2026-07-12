import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { EngagementQueryService } from "../../src/modules/engagement/engagement-query.service";
import { PacingService } from "../../src/modules/pacing/pacing.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";

function asUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "learner" };
}

describe("Pacing (integration)", () => {
	const prisma = getTestPrisma();
	const service = new PacingService(prisma, new EngagementQueryService(prisma));

	let userId: string;

	beforeEach(async () => {
		userId = (await createUser(prisma, { role: "learner" })).id;
	});

	async function setGoal(weeklyHours: string) {
		await prisma.user.update({ where: { id: userId }, data: { weeklyHours } });
	}

	async function lessons(n: number) {
		for (let i = 0; i < n; i++) {
			await prisma.progressEvent.create({
				data: { userId, entityType: "lesson", eventType: "completed" },
			});
		}
	}

	async function quiz(passed: boolean) {
		await prisma.progressEvent.create({
			data: {
				userId,
				entityType: "assessment",
				eventType: "attempt_submitted",
				metadataJson: { passed, score: passed ? 90 : 30 },
			},
		});
	}

	it("reports 'ahead' when the weekly goal is met", async () => {
		await setGoal("low"); // target 3
		await lessons(3);
		const signal = await service.signalFor(asUser(userId));
		expect(signal.state).toBe("ahead");
		expect(signal.targetPerWeek).toBe(3);
		expect(signal.lessonsThisWeek).toBe(3);
	});

	it("reports 'behind' when well under the goal", async () => {
		await setGoal("high"); // target 12
		await lessons(2);
		expect((await service.signalFor(asUser(userId))).state).toBe("behind");
	});

	it("reports 'rushing' when busy but failing quizzes", async () => {
		await setGoal("low"); // target 3
		await lessons(6);
		await quiz(false);
		await quiz(false);
		await quiz(true);
		expect((await service.signalFor(asUser(userId))).state).toBe("rushing");
	});

	it("has no target when the learner set no weekly goal", async () => {
		await lessons(2);
		const signal = await service.signalFor(asUser(userId));
		expect(signal.targetPerWeek).toBeNull();
		expect(signal.state).toBe("on_track");
	});

	it("ignores activity older than a week", async () => {
		await setGoal("low");
		await prisma.progressEvent.create({
			data: {
				userId,
				entityType: "lesson",
				eventType: "completed",
				createdAt: new Date(Date.now() - 10 * 86_400_000),
			},
		});
		expect((await service.signalFor(asUser(userId))).lessonsThisWeek).toBe(0);
	});
});
