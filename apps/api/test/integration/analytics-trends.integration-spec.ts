import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { AnalyticsTrendsService } from "../../src/modules/analytics/analytics-trends.service";
import { getTestPrisma } from "./support/db";
import { createCohort, createCourse, createUser } from "./support/factories";

function asUser(
	u: { id: string; email: string },
	role: "instructor" | "admin" = "instructor",
): AuthenticatedUser {
	return { id: u.id, email: u.email, role };
}

describe("AnalyticsTrendsService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new AnalyticsTrendsService(prisma);

	let instructor: { id: string; email: string };
	let learner: { id: string; email: string };

	beforeEach(async () => {
		instructor = await createUser(prisma, { role: "instructor" });
		learner = await createUser(prisma, { role: "learner" });
	});

	describe("enrolmentTrend", () => {
		it("buckets daily, zero-fills gaps, and only counts the caller's content", async () => {
			const mine = await createCourse(prisma, { createdBy: instructor.id });
			const other = await createUser(prisma, { role: "instructor" });
			const theirs = await createCourse(prisma, { createdBy: other.id });

			await prisma.courseEnrollment.createMany({
				data: [
					{ userId: learner.id, courseId: mine.id },
					{ userId: learner.id, courseId: theirs.id },
				],
			});

			const points = await service.enrolmentTrend(asUser(instructor), 7);

			expect(points).toHaveLength(7); // zero-filled window, no gaps
			const today = points.at(-1);
			expect(today?.courses).toBe(1); // theirs is not mine
			expect(points.slice(0, 6).every((p) => p.courses === 0)).toBe(true);
		});

		it("counts a taught cohort's enrolments for the assigned instructor", async () => {
			const admin = await createUser(prisma, { role: "admin" });
			const cohort = await createCohort(prisma, { createdBy: admin.id });
			await prisma.cohortInstructor.create({
				data: { cohortId: cohort.id, userId: instructor.id },
			});
			await prisma.cohortEnrollment.create({
				data: { userId: learner.id, cohortId: cohort.id },
			});

			const points = await service.enrolmentTrend(asUser(instructor), 7);
			expect(points.at(-1)?.cohorts).toBe(1);
		});
	});

	describe("earningsTrend", () => {
		it("books the guaranteed cut at paid time and the escrow cut at resolution time", async () => {
			const course = await createCourse(prisma, { createdBy: instructor.id });
			// Paid two months ago; escrow resolved this month — the two halves of
			// one sale land in DIFFERENT months (§8.5.1: money is booked when it
			// became theirs, not when the sale happened).
			const now = new Date();
			const twoMonthsAgo = new Date(
				Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 15),
			);
			const order = await prisma.order.create({
				data: {
					userId: learner.id,
					instructorId: instructor.id,
					entityType: "course",
					entityId: course.id,
					entityTitle: "T",
					amount: 100,
					currency: "NGN",
					status: "earn_back_issued",
					paidAt: twoMonthsAgo,
					instructorAmount: 42.75,
				},
				select: { id: true },
			});
			await prisma.earnBackTransaction.create({
				data: {
					orderId: order.id,
					userId: learner.id,
					amountPaid: 100,
					daysLate: 10,
					earnBackAmount: 38,
					forfeitedAmount: 9.5,
					forfeitedInstructorCut: 8.55,
					forfeitedPlatformCut: 0.95,
					currency: "NGN",
					status: "processed",
					// calculatedAt defaults to now() — this month's bucket.
				},
			});

			const points = await service.earningsTrend(asUser(instructor), 6);

			expect(points).toHaveLength(6);
			const saleMonth = twoMonthsAgo.toISOString().slice(0, 7);
			const thisMonth = now.toISOString().slice(0, 7);
			const bySale = points.find((p) => p.month === saleMonth);
			const byNow = points.find((p) => p.month === thisMonth);
			expect(bySale?.guaranteed).toBe(42.75);
			expect(bySale?.fromEscrow).toBe(0);
			expect(byNow?.fromEscrow).toBe(8.55);
			// Lifetime total reconciles with the Earn-Back ledger's "earned":
			// guaranteed + forfeited cut, never the at-stake base.
			const total = points.reduce((s, p) => s + p.guaranteed + p.fromEscrow, 0);
			expect(total).toBeCloseTo(42.75 + 8.55, 2);
		});

		it("never books an unpaid checkout", async () => {
			const course = await createCourse(prisma, { createdBy: instructor.id });
			await prisma.order.create({
				data: {
					userId: learner.id,
					instructorId: instructor.id,
					entityType: "course",
					entityId: course.id,
					entityTitle: "T",
					amount: 100,
					currency: "NGN",
					status: "pending",
					instructorAmount: 85.5,
				},
			});
			const points = await service.earningsTrend(asUser(instructor), 3);
			expect(points.every((p) => p.guaranteed === 0)).toBe(true);
		});
	});

	describe("platformRevenueTrend", () => {
		it("mirrors §14.1.1: settled orders only, split platform vs instructors", async () => {
			const course = await createCourse(prisma, { createdBy: instructor.id });
			await prisma.order.createMany({
				data: [
					{
						userId: learner.id,
						instructorId: instructor.id,
						entityType: "course",
						entityId: course.id,
						entityTitle: "T",
						amount: 100,
						currency: "NGN",
						status: "paid",
						paidAt: new Date(),
						platformAmount: 14.5,
						instructorAmount: 85.5,
					},
					// Unpaid checkout — must not appear anywhere.
					{
						userId: learner.id,
						instructorId: instructor.id,
						entityType: "course",
						entityId: course.id,
						entityTitle: "T",
						amount: 500,
						currency: "NGN",
						status: "pending",
						platformAmount: 72.5,
						instructorAmount: 427.5,
					},
				],
			});

			const points = await service.platformRevenueTrend(6);
			expect(points).toHaveLength(6);
			const thisMonth = points.at(-1);
			expect(thisMonth?.gross).toBe(100);
			expect(thisMonth?.platformTake).toBe(14.5);
			expect(thisMonth?.instructorEarnings).toBe(85.5);
			// The split must re-sum to gross — the stack height IS gross.
			expect(
				(thisMonth?.platformTake ?? 0) + (thisMonth?.instructorEarnings ?? 0),
			).toBeCloseTo(thisMonth?.gross ?? 0, 2);
		});
	});

	describe("antiCheatSummary", () => {
		it("counts flagged and UNMONITORED attempts separately (§4.6.2.1)", async () => {
			const mk = (over: Record<string, unknown>) =>
				prisma.assessmentAttempt.create({
					data: {
						userId: learner.id,
						attemptNumber: 1,
						submittedAt: new Date(),
						...over,
					},
				});
			await mk({ integrityScore: 100 }); // clean, watched
			await mk({ integrityScore: 90, flagCount: 1 }); // flagged
			// The §4.6.2.1 case: spotless score, but NOBODY was watching — every
			// integrity filter misses it; this summary must not.
			await mk({ integrityScore: 100, cameraMonitored: false });
			await mk({ integrityScore: 80, escalated: true, invalidated: true });

			const summary = await service.antiCheatSummary(30);
			expect(summary.attempts).toBe(4);
			expect(summary.flagged).toBe(2);
			expect(summary.unmonitored).toBe(1);
			expect(summary.escalated).toBe(1);
			expect(summary.invalidated).toBe(1);
		});

		it("ranks event types by count, descending", async () => {
			const attempt = await prisma.assessmentAttempt.create({
				data: { userId: learner.id, attemptNumber: 1 },
			});
			await prisma.assessmentAntiCheatLog.createMany({
				data: [
					{ attemptId: attempt.id, eventType: "tab_switch" },
					{ attemptId: attempt.id, eventType: "tab_switch" },
					{ attemptId: attempt.id, eventType: "devtools_open" },
				],
			});

			const { eventCounts } = await service.antiCheatSummary(30);
			expect(eventCounts[0]).toEqual({ eventType: "tab_switch", count: 2 });
			expect(eventCounts[1]).toEqual({ eventType: "devtools_open", count: 1 });
		});
	});

	describe("outcomeDistribution", () => {
		it("splits enrolments into not-started / in-progress / completed, reconciling", async () => {
			const course = await createCourse(prisma, { createdBy: instructor.id });
			const l2 = await createUser(prisma, { role: "learner" });
			const l3 = await createUser(prisma, { role: "learner" });
			await prisma.courseEnrollment.createMany({
				data: [learner.id, l2.id, l3.id].map((userId) => ({
					userId,
					courseId: course.id,
				})),
			});
			await prisma.completionStatus.createMany({
				data: [
					{
						userId: learner.id,
						entityType: "course",
						entityId: course.id,
						progressPercent: 100,
						isComplete: true,
					},
					{
						userId: l2.id,
						entityType: "course",
						entityId: course.id,
						progressPercent: 30,
						isComplete: false,
					},
				],
			});

			const d = await service.outcomeDistribution(asUser(instructor));
			expect(d).toEqual({ notStarted: 1, inProgress: 1, completed: 1 });
			// The donut MUST re-sum to total enrolments.
			expect(d.notStarted + d.inProgress + d.completed).toBe(3);
		});
	});

	describe("earnBackOutcomes", () => {
		it("splits resolved sales into on-time / late / missed", async () => {
			const course = await createCourse(prisma, { createdBy: instructor.id });
			const mkOrder = () =>
				prisma.order.create({
					data: {
						userId: learner.id,
						instructorId: instructor.id,
						entityType: "course",
						entityId: course.id,
						entityTitle: "T",
						amount: 100,
						currency: "NGN",
						status: "earn_back_issued",
					},
					select: { id: true },
				});
			const mkTxn = (orderId: string, daysLate: number, missed: boolean) =>
				prisma.earnBackTransaction.create({
					data: {
						orderId,
						userId: learner.id,
						amountPaid: 100,
						daysLate,
						earnBackAmount: missed ? 0 : 50,
						forfeitedAmount: missed ? 95 : 45,
						currency: "NGN",
						status: missed ? "no_payout" : "processed",
					},
				});
			const [o1, o2, o3] = await Promise.all([mkOrder(), mkOrder(), mkOrder()]);
			await mkTxn(o1.id, 0, false); // on time
			await mkTxn(o2.id, 12, false); // late
			await mkTxn(o3.id, 50, true); // missed — full forfeit

			expect(await service.earnBackOutcomes(asUser(instructor))).toEqual({
				onTime: 1,
				late: 1,
				missed: 1,
			});
		});
	});

	describe("activityHeatmap", () => {
		it("buckets an instructor's lesson events by UTC dow × hour, scoped to their content", async () => {
			const course = await createCourse(prisma, { createdBy: instructor.id });
			const mod = await prisma.module.create({
				data: { courseId: course.id, title: "M", orderIndex: 1 },
			});
			const lesson = await prisma.lesson.create({
				data: { moduleId: mod.id, title: "L", orderIndex: 1 },
			});
			// A known instant: Monday 2026-07-13 14:30 UTC → dow 1, hour 14.
			const instant = new Date("2026-07-13T14:30:00Z");
			await prisma.progressEvent.createMany({
				data: [
					{
						userId: learner.id,
						entityType: "lesson",
						entityId: lesson.id,
						eventType: "completed",
						createdAt: instant,
					},
					// Someone else's content — must not appear for this instructor.
					{
						userId: learner.id,
						entityType: "lesson",
						entityId: randomUUID(),
						eventType: "completed",
						createdAt: instant,
					},
				],
			});

			const cells = await service.activityHeatmap(asUser(instructor), 30);
			expect(cells).toEqual([{ dow: 1, hour: 14, count: 1 }]);

			// Admin sees both.
			const admin = await createUser(prisma, { role: "admin" });
			const all = await service.activityHeatmap(asUser(admin, "admin"), 30);
			expect(all[0]?.count).toBe(2);
		});
	});

	describe("revenueByType + learnerGrowth (admin)", () => {
		it("splits settled gross by entity type and grows learners cumulatively", async () => {
			const course = await createCourse(prisma, { createdBy: instructor.id });
			await prisma.order.createMany({
				data: [
					{
						userId: learner.id,
						entityType: "course",
						entityId: course.id,
						entityTitle: "T",
						amount: 100,
						currency: "NGN",
						status: "paid",
						paidAt: new Date(),
					},
					{
						userId: learner.id,
						entityType: "path",
						entityId: randomUUID(),
						entityTitle: "P",
						amount: 40,
						currency: "NGN",
						status: "earn_back_issued",
						paidAt: new Date(),
					},
					{
						userId: learner.id,
						entityType: "course",
						entityId: course.id,
						entityTitle: "T",
						amount: 999,
						currency: "NGN",
						status: "pending", // never counted
					},
				],
			});

			const byType = await service.revenueByType();
			expect(byType).toEqual([
				{ entityType: "course", gross: 100 },
				{ entityType: "path", gross: 40 },
			]);

			const growth = await service.learnerGrowth(3);
			expect(growth).toHaveLength(3);
			// Cumulative: monotone non-decreasing, ending at the current total.
			const totals = growth.map((g) => g.total);
			expect([...totals].sort((a, b) => a - b)).toEqual(totals);
			expect(totals.at(-1)).toBe(
				await prisma.user.count({ where: { role: "learner" } }),
			);
		});
	});

	describe("completionFunnel", () => {
		async function seededCourse() {
			const course = await createCourse(prisma, { createdBy: instructor.id });
			const l2 = await createUser(prisma, { role: "learner" });
			const l3 = await createUser(prisma, { role: "learner" });
			await prisma.courseEnrollment.createMany({
				data: [learner.id, l2.id, l3.id].map((userId) => ({
					userId,
					courseId: course.id,
				})),
			});
			// learner: completed · l2: started · l3: enrolled only.
			await prisma.completionStatus.createMany({
				data: [
					{
						userId: learner.id,
						entityType: "course",
						entityId: course.id,
						progressPercent: 100,
						isComplete: true,
					},
					{
						userId: l2.id,
						entityType: "course",
						entityId: course.id,
						progressPercent: 40,
						isComplete: false,
					},
				],
			});
			return course;
		}

		it("computes enrolled → started → completed, monotone", async () => {
			const course = await seededCourse();
			const { stages } = await service.completionFunnel(
				asUser(instructor),
				"course",
				course.id,
			);
			expect(stages).toEqual([
				{ key: "enrolled", count: 3 },
				{ key: "started", count: 2 },
				{ key: "completed", count: 1 },
			]);
		});

		it("lets an ASSIGNED cohort instructor read a cohort funnel they don't own", async () => {
			const admin = await createUser(prisma, { role: "admin" });
			const cohort = await createCohort(prisma, { createdBy: admin.id });
			await prisma.cohortInstructor.create({
				data: { cohortId: cohort.id, userId: instructor.id },
			});

			const { stages } = await service.completionFunnel(
				asUser(instructor),
				"cohort",
				cohort.id,
			);
			expect(stages[0]).toEqual({ key: "enrolled", count: 0 });
		});

		it("refuses an instructor with no claim on the content", async () => {
			const admin = await createUser(prisma, { role: "admin" });
			const cohort = await createCohort(prisma, { createdBy: admin.id });

			await expect(
				service.completionFunnel(asUser(instructor), "cohort", cohort.id),
			).rejects.toThrow(/do not own/i);
		});
	});
});
