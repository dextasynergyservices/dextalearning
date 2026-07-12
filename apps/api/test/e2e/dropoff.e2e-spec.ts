import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { resetDatabase } from "../integration/support/reset-db";
import { registerAndLogin } from "./support/auth";
import { buildE2eApp } from "./support/bootstrap";

const DAY = 86_400_000;

describe("Drop-off predictor (e2e)", () => {
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

	it("403s a non-admin trying to run the sweep", async () => {
		const { agent } = await registerAndLogin(app, prisma, { role: "learner" });
		await agent.post("/api/v1/admin/dropoff/run").expect(403);
	});

	it("runs the sweep and surfaces risk in the instructor's cohort view", async () => {
		// A cohort with a long-inactive learner.
		const cohort = await prisma.cohort.create({
			data: { title: "Cohort", slug: `c-${Date.now()}`, status: "open" },
		});
		const learner = await prisma.user.create({
			data: {
				email: `l-${Date.now()}@example.com`,
				firstName: "Idle",
				lastName: "Learner",
				role: "learner",
			},
		});
		await prisma.cohortEnrollment.create({
			data: {
				cohortId: cohort.id,
				userId: learner.id,
				status: "active",
				enrolledAt: new Date(Date.now() - 30 * DAY),
			},
		});
		await prisma.progressEvent.create({
			data: {
				userId: learner.id,
				entityType: "lesson",
				eventType: "completed",
				createdAt: new Date(Date.now() - 20 * DAY),
			},
		});

		// An instructor assigned to the cohort, promoted to admin to run the sweep.
		const { agent, userId } = await registerAndLogin(app, prisma, {
			role: "instructor",
		});
		await prisma.cohortInstructor.create({
			data: { cohortId: cohort.id, userId },
		});
		await prisma.user.update({
			where: { id: userId },
			data: { role: "admin" },
		});

		const run = await agent.post("/api/v1/admin/dropoff/run").expect(201);
		expect(run.body.data.flagged).toBeGreaterThanOrEqual(1);

		// The instructor's cohort detail now carries the learner's risk.
		const detail = await agent
			.get(`/api/v1/instructor/cohorts/${cohort.id}`)
			.expect(200);
		const flagged = detail.body.data.learners.find(
			(l: { userId: string }) => l.userId === learner.id,
		);
		expect(flagged.risk.level).toBe("high");
	});
});
