import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { GroupingService } from "../../src/modules/grouping/grouping.service";
import { NotificationsService } from "../../src/modules/notifications/notifications.service";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { getTestPrisma } from "./support/db";
import { createCohort, createUser } from "./support/factories";
import { FakeNotificationAdapter } from "./support/fakes/fake-notification.adapter";

const admin: AuthenticatedUser = {
	id: "admin",
	email: "admin@example.com",
	role: "admin",
};

async function enroll(
	prisma: PrismaService,
	cohortId: string,
	count: number,
	level: "beginner" | "intermediate" | "advanced" | null = null,
): Promise<string[]> {
	const ids: string[] = [];
	for (let i = 0; i < count; i++) {
		const user = await createUser(prisma, { role: "learner" });
		if (level) {
			await prisma.user.update({
				where: { id: user.id },
				data: { skillLevel: level },
			});
		}
		await prisma.cohortEnrollment.create({
			data: { cohortId, userId: user.id, status: "active" },
		});
		ids.push(user.id);
	}
	return ids;
}

function configureCohort(
	prisma: PrismaService,
	cohortId: string,
	mode: "randomized" | "skill_based" | "balanced" | "manual",
	targetGroupSize = 3,
) {
	return prisma.cohort.update({
		where: { id: cohortId },
		data: { groupingMode: mode, targetGroupSize },
	});
}

describe("GroupingService (integration)", () => {
	const prisma = getTestPrisma();
	const port = new FakeNotificationAdapter();
	const service = new GroupingService(
		prisma,
		new NotificationsService(prisma, port),
	);

	let cohortId: string;

	beforeEach(async () => {
		port.reset();
		cohortId = (await createCohort(prisma)).id;
	});

	it("randomized: assigns every enrolled learner exactly once, and notifies nobody on first generation", async () => {
		const ids = await enroll(prisma, cohortId, 7);
		await configureCohort(prisma, cohortId, "randomized", 3);

		const board = await service.generateGroups(admin, cohortId);

		expect(board.groups).toHaveLength(3); // ceil(7/3)
		const placed = board.groups.flatMap((g) => g.members.map((m) => m.userId));
		expect(placed.sort()).toEqual([...ids].sort());
		expect(board.unassigned).toHaveLength(0);
		// First generation is not a "reassignment" — no notices.
		expect(port.emails).toHaveLength(0);
		expect(await prisma.notification.count({ where: {} })).toBe(0);
	});

	it("skill_based is stable: re-running with the same roster notifies nobody", async () => {
		await enroll(prisma, cohortId, 6, "beginner");
		await configureCohort(prisma, cohortId, "skill_based", 3);

		await service.generateGroups(admin, cohortId);
		port.reset();
		await service.generateGroups(admin, cohortId);

		expect(port.emails).toHaveLength(0);
	});

	it("notifies the affected learners when a re-group changes their group", async () => {
		await enroll(prisma, cohortId, 6, "beginner");
		await configureCohort(prisma, cohortId, "skill_based", 3);
		await service.generateGroups(admin, cohortId);

		// Grow the roster → composition shifts (2 groups → 3), everyone moves.
		port.reset();
		await enroll(prisma, cohortId, 3, "beginner");
		await service.generateGroups(admin, cohortId);

		expect(port.emails.length).toBeGreaterThan(0);
		const rows = await prisma.notification.findMany({
			where: { type: "group_reassigned" },
		});
		expect(rows.length).toBeGreaterThan(0);
	});

	it("manual: generates empty containers and honours drag-and-drop moves without notifying", async () => {
		const ids = await enroll(prisma, cohortId, 4);
		await configureCohort(prisma, cohortId, "manual", 2);

		const board = await service.generateGroups(admin, cohortId);
		expect(board.groups).toHaveLength(2); // ceil(4/2)
		expect(board.groups.every((g) => g.members.length === 0)).toBe(true);
		expect(board.unassigned).toHaveLength(4);

		const targetGroup = board.groups[0].id;
		await service.manualAssign(admin, cohortId, ids[0], targetGroup);
		let after = await service.listGroups(admin, cohortId);
		expect(
			after.groups
				.find((g) => g.id === targetGroup)
				?.members.map((m) => m.userId),
		).toContain(ids[0]);
		expect(after.unassigned.map((m) => m.userId)).not.toContain(ids[0]);
		// Drag-and-drop is silent.
		expect(port.emails).toHaveLength(0);

		// Moving out (null) returns the learner to unassigned.
		await service.manualAssign(admin, cohortId, ids[0], null);
		after = await service.listGroups(admin, cohortId);
		expect(after.unassigned.map((m) => m.userId)).toContain(ids[0]);
	});

	it("supports create / rename / delete group and promoting a lead", async () => {
		const ids = await enroll(prisma, cohortId, 2);
		await configureCohort(prisma, cohortId, "manual", 5);

		const created = await service.createGroup(admin, cohortId, "Team Alpha");
		await service.renameGroup(admin, cohortId, created.id, "Team Omega");
		await service.manualAssign(admin, cohortId, ids[0], created.id);
		await service.setLead(admin, cohortId, created.id, ids[0]);

		let board = await service.listGroups(admin, cohortId);
		const group = board.groups.find((g) => g.id === created.id);
		expect(group?.name).toBe("Team Omega");
		expect(group?.members.find((m) => m.userId === ids[0])?.role).toBe("lead");

		await service.deleteGroup(admin, cohortId, created.id);
		board = await service.listGroups(admin, cohortId);
		expect(board.groups.find((g) => g.id === created.id)).toBeUndefined();
		// Its member returns to the unassigned pool, not deleted.
		expect(board.unassigned.map((m) => m.userId)).toContain(ids[0]);
	});

	it("lets an assigned facilitator manage groups but blocks everyone else", async () => {
		await enroll(prisma, cohortId, 3);
		await configureCohort(prisma, cohortId, "randomized", 3);

		const facilitator = await createUser(prisma, { role: "facilitator" });
		const stranger = await createUser(prisma, { role: "facilitator" });
		const asUser = (id: string): AuthenticatedUser => ({
			id,
			email: `${id}@example.com`,
			role: "facilitator",
		});

		// Not assigned yet → blocked.
		await expect(
			service.listGroups(asUser(stranger.id), cohortId),
		).rejects.toThrow();

		await prisma.cohortFacilitator.create({
			data: { cohortId, userId: facilitator.id },
		});
		await expect(
			service.generateGroups(asUser(facilitator.id), cohortId),
		).resolves.toBeTruthy();
		// The unassigned facilitator still can't.
		await expect(
			service.listGroups(asUser(stranger.id), cohortId),
		).rejects.toThrow();
	});

	it("treats facilitation as a per-cohort assignment: a LEARNER assigned to a cohort can manage it", async () => {
		await enroll(prisma, cohortId, 3);
		await configureCohort(prisma, cohortId, "manual", 3);
		// A plain learner — no global facilitator role at all.
		const learner = await createUser(prisma, { role: "learner" });
		const asLearner: AuthenticatedUser = {
			id: learner.id,
			email: "l@example.com",
			role: "learner",
		};

		await expect(service.listGroups(asLearner, cohortId)).rejects.toThrow();

		await prisma.cohortFacilitator.create({
			data: { cohortId, userId: learner.id },
		});
		const board = await service.listGroups(asLearner, cohortId);
		expect(board.cohort.id).toBe(cohortId);
	});

	it("lists the cohorts a user is assigned to facilitate", async () => {
		const facilitator = await createUser(prisma, { role: "instructor" });
		const other = (await createCohort(prisma)).id;
		await prisma.cohortFacilitator.create({
			data: { cohortId, userId: facilitator.id },
		});
		await prisma.cohortFacilitator.create({
			data: { cohortId: other, userId: facilitator.id },
		});
		await enroll(prisma, cohortId, 2);

		const mine = await service.myFacilitatedCohorts({
			id: facilitator.id,
			email: "f@example.com",
			role: "instructor",
		});
		expect(mine).toHaveLength(2);
		expect(mine.map((c) => c.id).sort()).toEqual([cohortId, other].sort());
		expect(mine.find((c) => c.id === cohortId)?.learnerCount).toBe(2);
	});
});
