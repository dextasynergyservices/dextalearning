import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { LeaderboardService } from "../../src/modules/leaderboard/leaderboard.service";
import type { CachePort } from "../../src/shared/cache/cache.port";
import { getTestPrisma } from "./support/db";
import { createCohort, createUser } from "./support/factories";

class MemoryCache implements CachePort {
	store = new Map<string, string>();
	async get<T>(key: string): Promise<T | null> {
		const raw = this.store.get(key);
		return raw ? (JSON.parse(raw) as T) : null;
	}
	async set(key: string, value: unknown): Promise<void> {
		this.store.set(key, JSON.stringify(value));
	}
	async del(key: string): Promise<void> {
		this.store.delete(key);
	}
}

const asUser = (id: string): AuthenticatedUser => ({
	id,
	email: `${id}@example.com`,
	role: "learner",
});

describe("LeaderboardService (integration)", () => {
	const prisma = getTestPrisma();
	let cache: MemoryCache;
	let service: LeaderboardService;

	beforeEach(() => {
		cache = new MemoryCache();
		service = new LeaderboardService(prisma, cache);
	});

	async function lessonCompleted(userId: string, at?: Date) {
		await prisma.progressEvent.create({
			data: {
				userId,
				entityType: "lesson",
				eventType: "completed",
				...(at ? { createdAt: at } : {}),
			},
		});
	}
	async function entityCompleted(userId: string) {
		await prisma.progressEvent.create({
			data: { userId, entityType: "course", eventType: "completed" },
		});
	}
	async function attempt(
		userId: string,
		scope: string,
		score: number,
		passed = true,
		lessonId = "l1",
	) {
		await prisma.progressEvent.create({
			data: {
				userId,
				entityType: "assessment",
				eventType: "attempt_submitted",
				metadataJson: { score, passed, scope, lessonId },
			},
		});
	}

	it("overall: ranks by weighted achievements and returns the caller's position", async () => {
		const u1 = (await createUser(prisma)).id;
		const u2 = (await createUser(prisma)).id;
		await lessonCompleted(u1);
		await lessonCompleted(u1);
		await entityCompleted(u1); // u1 = 20 + 50 = 70
		await lessonCompleted(u2); // u2 = 10

		const board = await service.getLeaderboard(asUser(u1), {
			type: "overall",
			period: "all_time",
			limit: 20,
		});

		expect(board.kind).toBe("user");
		expect(board.entries.map((e) => e.subjectId)).toEqual([u1, u2]);
		expect(board.entries[0]).toMatchObject({
			score: 70,
			rank: 1,
			isSelf: true,
		});
		expect(board.entries[1]).toMatchObject({ score: 10, rank: 2 });
		expect(board.me).toMatchObject({ subjectId: u1, rank: 1 });
	});

	it("improved: sums pre→post quiz deltas", async () => {
		const u1 = (await createUser(prisma)).id;
		const u2 = (await createUser(prisma)).id;
		await attempt(u1, "lesson_pre", 40);
		await attempt(u1, "lesson_post", 90); // +50
		await attempt(u2, "lesson_pre", 50);
		await attempt(u2, "lesson_post", 55); // +5

		const board = await service.getLeaderboard(asUser(u1), {
			type: "improved",
			period: "all_time",
			limit: 20,
		});
		expect(board.entries[0]).toMatchObject({ subjectId: u1, score: 50 });
		expect(board.entries[1]).toMatchObject({ subjectId: u2, score: 5 });
	});

	it("peer: ranks by peer reviews contributed", async () => {
		const u1 = (await createUser(prisma)).id;
		const u2 = (await createUser(prisma)).id;
		for (let i = 0; i < 3; i++)
			await prisma.projectPeerReview.create({ data: { reviewerUserId: u1 } });
		await prisma.projectPeerReview.create({ data: { reviewerUserId: u2 } });

		const board = await service.getLeaderboard(asUser(u1), {
			type: "peer",
			period: "all_time",
			limit: 20,
		});
		expect(board.entries[0]).toMatchObject({ subjectId: u1, score: 45 });
		expect(board.entries[1]).toMatchObject({ subjectId: u2, score: 15 });
	});

	it("group: ranks groups by their members' average overall score", async () => {
		const cohortId = (await createCohort(prisma)).id;
		const u1 = (await createUser(prisma)).id;
		const u2 = (await createUser(prisma)).id;
		const u3 = (await createUser(prisma)).id;
		for (const userId of [u1, u2, u3])
			await prisma.cohortEnrollment.create({
				data: { cohortId, userId, status: "active" },
			});
		await entityCompleted(u1); // 50
		// Group A: u1(50) + u2(0) → avg 25; Group B: u3(0) → avg 0.
		const groupA = await prisma.group.create({
			data: { cohortId, name: "Alpha" },
		});
		const groupB = await prisma.group.create({
			data: { cohortId, name: "Beta" },
		});
		await prisma.groupMember.createMany({
			data: [
				{ groupId: groupA.id, userId: u1 },
				{ groupId: groupA.id, userId: u2 },
				{ groupId: groupB.id, userId: u3 },
			],
		});

		const board = await service.getLeaderboard(asUser(u1), {
			type: "group",
			cohortId,
			period: "all_time",
			limit: 20,
		});
		expect(board.kind).toBe("group");
		expect(board.entries[0]).toMatchObject({
			subjectId: groupA.id,
			name: "Alpha",
			score: 25,
			rank: 1,
			isSelf: true, // u1 is in Group Alpha
		});
		expect(board.entries[1]).toMatchObject({ subjectId: groupB.id, score: 0 });
		expect(board.me?.subjectId).toBe(groupA.id);
	});

	it("cohort scope excludes non-members; weekly period excludes stale activity", async () => {
		const cohortId = (await createCohort(prisma)).id;
		const inside = (await createUser(prisma)).id;
		const outside = (await createUser(prisma)).id;
		await prisma.cohortEnrollment.create({
			data: { cohortId, userId: inside, status: "active" },
		});
		await lessonCompleted(inside);
		await lessonCompleted(outside);

		const scoped = await service.getLeaderboard(asUser(inside), {
			type: "overall",
			cohortId,
			period: "all_time",
			limit: 20,
		});
		expect(scoped.entries.map((e) => e.subjectId)).toEqual([inside]);

		// Weekly: an event from 10 days ago is out of the window.
		const stale = (await createUser(prisma)).id;
		await lessonCompleted(stale, new Date(Date.now() - 10 * 86_400_000));
		const recent = (await createUser(prisma)).id;
		await lessonCompleted(recent);
		const weekly = await service.getLeaderboard(asUser(recent), {
			type: "overall",
			period: "weekly",
			limit: 20,
		});
		expect(weekly.entries.map((e) => e.subjectId)).not.toContain(stale);
		expect(weekly.entries.map((e) => e.subjectId)).toContain(recent);
	});

	it("serves a cached board on the second call (stale until TTL)", async () => {
		const u1 = (await createUser(prisma)).id;
		await lessonCompleted(u1);
		const first = await service.getLeaderboard(asUser(u1), {
			type: "overall",
			period: "all_time",
			limit: 20,
		});
		expect(first.total).toBe(1);

		// A new high scorer added AFTER the first call is not reflected — cache hit.
		const u2 = (await createUser(prisma)).id;
		await entityCompleted(u2);
		const second = await service.getLeaderboard(asUser(u1), {
			type: "overall",
			period: "all_time",
			limit: 20,
		});
		expect(second.total).toBe(1);

		// A different cache key (period) recomputes and sees both.
		const weekly = await service.getLeaderboard(asUser(u1), {
			type: "overall",
			period: "weekly",
			limit: 20,
		});
		expect(weekly.total).toBe(2);
	});
});
