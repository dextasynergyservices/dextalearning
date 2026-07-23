import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { LifecycleRemindersService } from "../../src/modules/reminders/lifecycle-reminders.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";

/**
 * The calendar-driven §8.6 notices. The behaviour that actually matters here is
 * catch-up safety: on a scale-to-zero host the sweep WILL miss days, and a
 * kickoff is a one-off moment — if a late run can't recover it, the notice is
 * lost forever and nobody finds out.
 */
describe("LifecycleRemindersService (integration)", () => {
	const prisma = getTestPrisma();
	const notify = vi.fn().mockResolvedValue(undefined);
	const service = new LifecycleRemindersService(prisma, {
		notify,
	} as unknown as NotificationsService);

	/** A UTC midnight `days` before `from`. */
	function daysBefore(from: Date, days: number): Date {
		const d = new Date(
			Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
		);
		d.setUTCDate(d.getUTCDate() - days);
		return d;
	}

	let learnerId: string;
	const now = new Date();

	beforeEach(async () => {
		notify.mockClear();
		learnerId = (await createUser(prisma, { role: "learner" })).id;
	});

	async function cohortStarting(startsAt: Date, slug: string) {
		const cohort = await prisma.cohort.create({
			data: { title: `Cohort ${slug}`, slug, status: "active", startsAt },
		});
		await prisma.cohortEnrollment.create({
			data: { cohortId: cohort.id, userId: learnerId },
		});
		return cohort;
	}

	describe("cohort kickoff", () => {
		it("notifies enrolled learners when a cohort starts today", async () => {
			await cohortStarting(now, "kick-today");
			const { kickoffs } = await service.sweep(now);
			expect(kickoffs).toBe(1);
			expect(notify).toHaveBeenCalledWith(
				learnerId,
				expect.objectContaining({ type: "cohort_kickoff" }),
			);
		});

		/** The regression this fix exists for. */
		it("still catches a kickoff the sweep missed on the day", async () => {
			await cohortStarting(daysBefore(now, 2), "kick-missed");
			const { kickoffs } = await service.sweep(now);
			expect(kickoffs).toBe(1);
		});

		it("sends exactly once even when the sweep runs every day after", async () => {
			await cohortStarting(daysBefore(now, 1), "kick-once");
			const first = await service.sweep(now);
			const second = await service.sweep(now);
			// A later day's run must not re-send: the dedup is keyed on the cohort's
			// start day, not on the day the sweep happens to run.
			const nextDay = new Date(now.getTime() + 86_400_000);
			const third = await service.sweep(nextDay);
			expect(first.kickoffs).toBe(1);
			expect(second.kickoffs).toBe(0);
			expect(third.kickoffs).toBe(0);
		});

		it("tells a learner about EACH cohort starting the same day", async () => {
			// Keyed per cohort, so two same-day starts are two notices — a single
			// per-day key would silently drop one of them.
			await cohortStarting(now, "kick-a");
			await cohortStarting(now, "kick-b");
			const { kickoffs } = await service.sweep(now);
			expect(kickoffs).toBe(2);
		});

		it("ignores cohorts starting in the future or long past", async () => {
			await cohortStarting(
				new Date(now.getTime() + 3 * 86_400_000),
				"kick-fut",
			);
			await cohortStarting(daysBefore(now, 30), "kick-old");
			const { kickoffs } = await service.sweep(now);
			expect(kickoffs).toBe(0);
		});
	});

	describe("deadlines", () => {
		it("batches everything due into ONE notice per learner per day", async () => {
			const course = await prisma.course.create({
				data: { title: "C", slug: "dl-course", status: "published" },
			});
			await prisma.courseEnrollment.create({
				data: { courseId: course.id, userId: learnerId },
			});
			const soon = new Date(now.getTime() + 24 * 3_600_000);
			await prisma.project.create({
				data: {
					title: "P1",
					scope: "course",
					courseId: course.id,
					orderIndex: 1,
					dueAt: soon,
				},
			});
			await prisma.project.create({
				data: {
					title: "P2",
					scope: "course",
					courseId: course.id,
					orderIndex: 2,
					dueAt: soon,
				},
			});

			const { deadlines } = await service.sweep(now);
			expect(deadlines).toBe(1);
			const call = notify.mock.calls.find(
				(c) => c[1]?.type === "deadline_soon",
			);
			expect(call?.[1].dataJson).toMatchObject({ count: 2 });
		});

		it("leaves out work the learner has already submitted", async () => {
			const course = await prisma.course.create({
				data: { title: "C2", slug: "dl-done", status: "published" },
			});
			await prisma.courseEnrollment.create({
				data: { courseId: course.id, userId: learnerId },
			});
			const project = await prisma.project.create({
				data: {
					title: "Submitted",
					scope: "course",
					courseId: course.id,
					orderIndex: 1,
					dueAt: new Date(now.getTime() + 24 * 3_600_000),
				},
			});
			await prisma.projectSubmission.create({
				data: { projectId: project.id, userId: learnerId },
			});

			const { deadlines } = await service.sweep(now);
			expect(deadlines).toBe(0);
		});
	});
});
