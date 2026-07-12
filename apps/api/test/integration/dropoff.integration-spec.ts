import { beforeEach, describe, expect, it } from "vitest";
import { DropoffService } from "../../src/modules/dropoff/dropoff.service";
import { DropoffQueryService } from "../../src/modules/dropoff/dropoff-query.service";
import { EngagementQueryService } from "../../src/modules/engagement/engagement-query.service";
import { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { getTestPrisma } from "./support/db";
import { createCohort, createUser } from "./support/factories";
import { FakeNotificationAdapter } from "./support/fakes/fake-notification.adapter";

const DAY = 86_400_000;

describe("Drop-off predictor (integration)", () => {
	const prisma = getTestPrisma();
	const port = new FakeNotificationAdapter();
	const notifications = new NotificationsService(prisma, port);
	const engagementQuery = new EngagementQueryService(prisma);
	const service = new DropoffService(prisma, engagementQuery, notifications);
	const query = new DropoffQueryService(prisma);

	let cohortId: string;
	let learnerId: string;

	beforeEach(async () => {
		port.reset();
		cohortId = (await createCohort(prisma)).id;
		learnerId = (await createUser(prisma, { role: "learner" })).id;
	});

	async function enroll(userId: string, daysAgo: number) {
		await prisma.cohortEnrollment.create({
			data: {
				cohortId,
				userId,
				status: "active",
				enrolledAt: new Date(Date.now() - daysAgo * DAY),
			},
		});
	}

	async function activityDaysAgo(userId: string, daysAgo: number) {
		await prisma.progressEvent.create({
			data: {
				userId,
				entityType: "lesson",
				eventType: "completed",
				createdAt: new Date(Date.now() - daysAgo * DAY),
			},
		});
	}

	it("flags a long-inactive learner as high risk", async () => {
		await enroll(learnerId, 30);
		await activityDaysAgo(learnerId, 20);

		const { flagged } = await service.sweep();
		expect(flagged).toBe(1);

		const flags = await query.flagsForCohort(cohortId);
		expect(flags.get(learnerId)?.level).toBe("high");
		expect(flags.get(learnerId)?.reasons).toContain("inactive_14d");
	});

	it("does not flag a recently-active learner", async () => {
		await enroll(learnerId, 30);
		await activityDaysAgo(learnerId, 1);

		await service.sweep();
		const flags = await query.flagsForCohort(cohortId);
		expect(flags.has(learnerId)).toBe(false);
	});

	it("flags an enrolled-but-never-started learner", async () => {
		await enroll(learnerId, 10); // no activity at all
		await service.sweep();
		const flags = await query.flagsForCohort(cohortId);
		expect(flags.get(learnerId)?.level).toBe("high");
		expect(flags.get(learnerId)?.reasons).toContain("never_started");
	});

	it("clears the flag once a learner becomes active again (re-sweep)", async () => {
		await enroll(learnerId, 30);
		await activityDaysAgo(learnerId, 20);
		await service.sweep();
		expect((await query.flagsForCohort(cohortId)).has(learnerId)).toBe(true);

		// Learner returns today; re-running the sweep must remove the stale flag.
		await activityDaysAgo(learnerId, 0);
		await service.sweep();
		expect((await query.flagsForCohort(cohortId)).has(learnerId)).toBe(false);
	});

	it("never flags a learner who completed the cohort", async () => {
		await enroll(learnerId, 40); // no activity, but completed
		await prisma.completionStatus.create({
			data: {
				userId: learnerId,
				entityType: "cohort",
				entityId: cohortId,
				isComplete: true,
				progressPercent: 100,
			},
		});
		await service.sweep();
		expect((await query.flagsForCohort(cohortId)).has(learnerId)).toBe(false);
	});

	it("alerts assigned instructors + facilitators, once per day (dedup)", async () => {
		await enroll(learnerId, 30);
		await activityDaysAgo(learnerId, 20); // high risk

		const instructor = await createUser(prisma, { role: "instructor" });
		const facilitator = await createUser(prisma, { role: "learner" });
		await prisma.cohortInstructor.create({
			data: { cohortId, userId: instructor.id },
		});
		await prisma.cohortFacilitator.create({
			data: { cohortId, userId: facilitator.id },
		});

		await service.sweep();
		const alerts = await prisma.notification.findMany({
			where: { type: "dropoff_alert" },
		});
		expect(alerts.map((a) => a.userId).sort()).toEqual(
			[instructor.id, facilitator.id].sort(),
		);

		// Same-day re-sweep must not double-alert.
		await service.sweep();
		expect(
			await prisma.notification.count({ where: { type: "dropoff_alert" } }),
		).toBe(2);
	});

	it("atRiskCountsFor tallies high/medium per cohort", async () => {
		await enroll(learnerId, 30);
		await activityDaysAgo(learnerId, 20); // high
		const other = await createUser(prisma, { role: "learner" });
		await enroll(other.id, 30);
		await activityDaysAgo(other.id, 9); // medium

		await service.sweep();
		const counts = await query.atRiskCountsFor([cohortId]);
		expect(counts.get(cohortId)).toEqual({ high: 1, medium: 1, total: 2 });
	});
});
