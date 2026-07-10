import { beforeEach, describe, expect, it } from "vitest";
import { ChatService } from "../../src/modules/chat/chat.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { getTestPrisma } from "./support/db";
import { createCohort, createUser } from "./support/factories";

const learner = (id: string) => ({ id, role: "learner" as const });

async function makeGroup(
	prisma: PrismaService,
	cohortId: string,
	name = "Alpha",
) {
	return prisma.group.create({ data: { cohortId, name } });
}

describe("ChatService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new ChatService(prisma);

	let cohortId: string;
	let groupId: string;
	let memberId: string;

	beforeEach(async () => {
		cohortId = (await createCohort(prisma)).id;
		groupId = (await makeGroup(prisma, cohortId)).id;
		memberId = (await createUser(prisma)).id;
		await prisma.groupMember.create({
			data: { groupId, userId: memberId },
		});
	});

	describe("assertAccess", () => {
		it("admits members, the admin, and an assigned facilitator; rejects others", async () => {
			await expect(
				service.assertAccess(learner(memberId), groupId),
			).resolves.toBe(cohortId);

			const admin = await createUser(prisma, { role: "admin" });
			await expect(
				service.assertAccess({ id: admin.id, role: "admin" }, groupId),
			).resolves.toBe(cohortId);

			const facilitator = await createUser(prisma);
			await prisma.cohortFacilitator.create({
				data: { cohortId, userId: facilitator.id },
			});
			await expect(
				service.assertAccess(learner(facilitator.id), groupId),
			).resolves.toBe(cohortId);

			const stranger = await createUser(prisma);
			await expect(
				service.assertAccess(learner(stranger.id), groupId),
			).rejects.toThrow();
		});

		it("404s for a missing group", async () => {
			await expect(
				service.assertAccess(learner(memberId), memberId),
			).rejects.toThrow();
		});
	});

	it("persists messages and returns history ascending, with the author name", async () => {
		await service.saveMessage(memberId, groupId, "first");
		await service.saveMessage(memberId, groupId, "second");
		await service.saveMessage(memberId, groupId, "third");

		const page = await service.history(learner(memberId), groupId, 30);
		expect(page.messages.map((m) => m.content)).toEqual([
			"first",
			"second",
			"third",
		]);
		expect(page.messages[0].authorName).toBe("Test User");
		expect(page.nextCursor).toBeNull();
	});

	it("paginates newest-first with a cursor", async () => {
		for (const c of ["m1", "m2", "m3"])
			await service.saveMessage(memberId, groupId, c);

		const first = await service.history(learner(memberId), groupId, 2);
		// Newest two, returned ascending for display: m2, m3.
		expect(first.messages.map((m) => m.content)).toEqual(["m2", "m3"]);
		expect(first.nextCursor).toBeTruthy();

		const second = await service.history(
			learner(memberId),
			groupId,
			2,
			first.nextCursor as string,
		);
		expect(second.messages.map((m) => m.content)).toEqual(["m1"]);
		expect(second.nextCursor).toBeNull();
	});

	it("history refuses a non-member", async () => {
		const stranger = await createUser(prisma);
		await expect(
			service.history(learner(stranger.id), groupId, 30),
		).rejects.toThrow();
	});

	it("finds a learner's group within a cohort and lists all their groups", async () => {
		const inCohort = await service.myGroupInCohort(memberId, cohortId);
		expect(inCohort).toMatchObject({
			id: groupId,
			name: "Alpha",
			memberCount: 1,
		});
		expect(await service.myGroupInCohort(memberId, cohortId)).not.toBeNull();

		const mine = await service.myGroups(memberId);
		expect(mine).toHaveLength(1);
		expect(mine[0]).toMatchObject({ id: groupId, cohortId });

		const stranger = await createUser(prisma);
		expect(await service.myGroupInCohort(stranger.id, cohortId)).toBeNull();
	});
});
