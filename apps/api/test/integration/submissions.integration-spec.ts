import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { CompletionService } from "../../src/modules/completion/completion.service";
import type { NotificationsService } from "../../src/modules/notifications/notifications.service";
import { SubmissionsService } from "../../src/modules/projects/submissions.service";
import { LearningEvents } from "../../src/shared/events/learning-events";
import { getTestPrisma } from "./support/db";
import { createLesson, createModule, createUser } from "./support/factories";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

function asAuthenticatedUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "learner" };
}

describe("SubmissionsService (integration)", () => {
	const prisma = getTestPrisma();
	const events = new EventEmitter2();
	// A real CompletionService — the finals gate (§4.3) is part of what these
	// specs are checking, so stubbing it would hide the thing under test.
	const notify = vi.fn().mockResolvedValue(undefined);
	const service = new SubmissionsService(
		prisma,
		new FakeStorageAdapter(),
		events,
		new CompletionService(prisma, new FakeStorageAdapter(), events),
		{ notify } as unknown as NotificationsService,
	);

	let learnerId: string;
	let emitted: { event: string; payload: unknown }[] = [];

	events.onAny((event, payload) => {
		emitted.push({ event: String(event), payload });
	});

	beforeEach(async () => {
		emitted = [];
		notify.mockClear();
		learnerId = (await createUser(prisma, { role: "learner" })).id;
	});

	describe("submit", () => {
		it("rejects an empty submission", async () => {
			const project = await prisma.project.create({
				data: { scope: "course", title: "Empty check", orderIndex: 1 },
			});
			await expect(
				service.submit(asAuthenticatedUser(learnerId), project.id, {}),
			).rejects.toThrow(BadRequestException);
		});

		it("creates the first submission at attempt 1", async () => {
			const project = await prisma.project.create({
				data: { scope: "course", title: "First submit", orderIndex: 1 },
			});
			const result = await service.submit(
				asAuthenticatedUser(learnerId),
				project.id,
				{ textContent: "My work" },
			);
			expect(result.attemptNumber).toBe(1);
			expect(result.graded).toBe(false);
		});

		it("reuses the current draft while it's ungraded", async () => {
			const project = await prisma.project.create({
				data: { scope: "course", title: "Draft reuse", orderIndex: 1 },
			});
			await service.submit(asAuthenticatedUser(learnerId), project.id, {
				textContent: "Draft v1",
			});
			await service.submit(asAuthenticatedUser(learnerId), project.id, {
				textContent: "Draft v2",
			});
			const count = await prisma.projectSubmission.count({
				where: { projectId: project.id, userId: learnerId },
			});
			expect(count).toBe(1);
		});

		it("rejects further submissions once passed", async () => {
			const project = await prisma.project.create({
				data: { scope: "course", title: "Already passed", orderIndex: 1 },
			});
			const submitted = await service.submit(
				asAuthenticatedUser(learnerId),
				project.id,
				{ textContent: "Winning entry" },
			);
			await prisma.projectSubmission.update({
				where: { id: submitted.id },
				data: { passed: true, gradedAt: new Date() },
			});
			await expect(
				service.submit(asAuthenticatedUser(learnerId), project.id, {
					textContent: "Another try",
				}),
			).rejects.toThrow(ConflictException);
		});

		it("starts a new attempt after a failed, graded submission", async () => {
			const project = await prisma.project.create({
				data: { scope: "course", title: "Retake", orderIndex: 1 },
			});
			const first = await service.submit(
				asAuthenticatedUser(learnerId),
				project.id,
				{ textContent: "Attempt 1" },
			);
			await prisma.projectSubmission.update({
				where: { id: first.id },
				data: { passed: false, gradedAt: new Date() },
			});
			const second = await service.submit(
				asAuthenticatedUser(learnerId),
				project.id,
				{ textContent: "Attempt 2" },
			);
			expect(second.attemptNumber).toBe(2);
			const count = await prisma.projectSubmission.count({
				where: { projectId: project.id, userId: learnerId },
			});
			expect(count).toBe(2);
		});
	});

	// ── The creator is told there's work waiting (§4.5) ─────────────────────
	describe("submission notification", () => {
		async function projectBy(creatorId: string, overrides = {}) {
			return prisma.project.create({
				data: {
					scope: "course",
					title: "Capstone",
					orderIndex: 1,
					createdBy: creatorId,
					...overrides,
				},
			});
		}

		it("tells the project's CREATOR a submission is waiting", async () => {
			const creator = await createUser(prisma, { role: "instructor" });
			const project = await projectBy(creator.id);

			await service.submit(asAuthenticatedUser(learnerId), project.id, {
				textContent: "My work",
			});

			expect(notify).toHaveBeenCalledWith(
				creator.id,
				expect.objectContaining({
					type: "project_submission_received",
					inApp: true,
					dataJson: expect.objectContaining({ projectId: project.id }),
				}),
			);
			// It emails too — the blueprint asks for both channels.
			expect(notify.mock.calls[0][1].email).toBeTruthy();
		});

		it("doesn't re-ping for a draft edit — it's the same pending work", async () => {
			const creator = await createUser(prisma, { role: "instructor" });
			const project = await projectBy(creator.id);

			await service.submit(asAuthenticatedUser(learnerId), project.id, {
				textContent: "Draft v1",
			});
			await service.submit(asAuthenticatedUser(learnerId), project.id, {
				textContent: "Draft v2",
			});
			expect(notify).toHaveBeenCalledTimes(1);
		});

		it("pings again on a fresh attempt after a graded failure", async () => {
			const creator = await createUser(prisma, { role: "instructor" });
			const project = await projectBy(creator.id);
			const first = await service.submit(
				asAuthenticatedUser(learnerId),
				project.id,
				{ textContent: "Attempt 1" },
			);
			await prisma.projectSubmission.update({
				where: { id: first.id },
				data: { passed: false, gradedAt: new Date() },
			});

			await service.submit(asAuthenticatedUser(learnerId), project.id, {
				textContent: "Attempt 2",
			});
			expect(notify).toHaveBeenCalledTimes(2);
		});

		it("stays quiet for peer-reviewed projects — peers grade those", async () => {
			const creator = await createUser(prisma, { role: "instructor" });
			const project = await projectBy(creator.id, {
				gradingType: "peer_review",
			});

			await service.submit(asAuthenticatedUser(learnerId), project.id, {
				textContent: "My work",
			});
			expect(notify).not.toHaveBeenCalled();
		});

		it("never fails the learner's submission if notifying blows up", async () => {
			const creator = await createUser(prisma, { role: "instructor" });
			const project = await projectBy(creator.id);
			notify.mockRejectedValueOnce(new Error("smtp down"));

			const result = await service.submit(
				asAuthenticatedUser(learnerId),
				project.id,
				{ textContent: "My work" },
			);
			expect(result.attemptNumber).toBe(1);
		});
	});

	describe("uploadFile", () => {
		it("rejects a file when the project doesn't accept file uploads", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "No files",
					orderIndex: 1,
					submissionTypes: ["text_submission"],
				},
			});
			await expect(
				service.uploadFile(asAuthenticatedUser(learnerId), project.id, {
					buffer: Buffer.from("data"),
					originalname: "work.pdf",
					mimetype: "application/pdf",
					size: 1000,
				}),
			).rejects.toThrow(BadRequestException);
		});

		it("rejects a disallowed file type", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Allowed types",
					orderIndex: 1,
					allowedFileTypes: ["zip"],
				},
			});
			await expect(
				service.uploadFile(asAuthenticatedUser(learnerId), project.id, {
					buffer: Buffer.from("data"),
					originalname: "work.pdf",
					mimetype: "application/pdf",
					size: 1000,
				}),
			).rejects.toThrow("Allowed types: zip");
		});

		it("rejects a file larger than the configured limit", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Size limit",
					orderIndex: 1,
					maxFileSizeMb: 1,
				},
			});
			await expect(
				service.uploadFile(asAuthenticatedUser(learnerId), project.id, {
					buffer: Buffer.from("data"),
					originalname: "work.zip",
					mimetype: "application/zip",
					size: 2 * 1024 * 1024,
				}),
			).rejects.toThrow("File must be 1 MB or smaller.");
		});

		it("stores an accepted file and returns a signed URL", async () => {
			const project = await prisma.project.create({
				data: { scope: "course", title: "Upload ok", orderIndex: 1 },
			});
			const result = await service.uploadFile(
				asAuthenticatedUser(learnerId),
				project.id,
				{
					buffer: Buffer.from("data"),
					originalname: "work.pdf",
					mimetype: "application/pdf",
					size: 1000,
				},
			);
			expect(result.name).toBe("work.pdf");
			expect(result.url).toContain("fake-storage.test");
		});
	});

	describe("getProjectInfo", () => {
		it("reports peer-review progress for a peer_review-graded project", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Peer reviewed",
					orderIndex: 1,
					gradingType: "peer_review",
					peerReviewCount: 2,
				},
			});
			const info = await service.getProjectInfo(
				asAuthenticatedUser(learnerId),
				project.id,
			);
			expect(info.peerReview).toEqual({ required: 2, completed: 0 });
			expect(info.mySubmission).toBeNull();
		});
	});

	describe("peer review", () => {
		it("lazily assigns up to peerReviewCount reviews, excluding the reviewer's own submission", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Peer pool",
					orderIndex: 1,
					gradingType: "peer_review",
					peerReviewCount: 2,
					rubricJson: [{ id: "quality", label: "Quality", maxPoints: 10 }],
				},
			});
			await service.submit(asAuthenticatedUser(learnerId), project.id, {
				textContent: "My own submission",
			});
			const peerA = await createUser(prisma, { role: "learner" });
			const peerB = await createUser(prisma, { role: "learner" });
			const peerC = await createUser(prisma, { role: "learner" });
			await prisma.projectSubmission.create({
				data: { projectId: project.id, userId: peerA.id, textContent: "A" },
			});
			await prisma.projectSubmission.create({
				data: { projectId: project.id, userId: peerB.id, textContent: "B" },
			});
			await prisma.projectSubmission.create({
				data: { projectId: project.id, userId: peerC.id, textContent: "C" },
			});

			const result = await service.listMyReviews(
				asAuthenticatedUser(learnerId),
				project.id,
			);
			expect(result.reviews).toHaveLength(2);
			expect(
				result.reviews.every((r) => r.textContent !== "My own submission"),
			).toBe(true);
		});

		it("forbids submitting a review not assigned to the caller", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Not yours",
					orderIndex: 1,
					gradingType: "peer_review",
					peerReviewCount: 1,
					rubricJson: [{ id: "quality", label: "Quality", maxPoints: 10 }],
				},
			});
			const author = await createUser(prisma, { role: "learner" });
			const submission = await prisma.projectSubmission.create({
				data: { projectId: project.id, userId: author.id, textContent: "Work" },
			});
			const review = await prisma.projectPeerReview.create({
				data: { submissionId: submission.id, reviewerUserId: learnerId },
			});
			const otherReviewer = await createUser(prisma, { role: "learner" });
			await expect(
				service.submitReview(asAuthenticatedUser(otherReviewer.id), review.id, {
					rubricScores: [{ criterionId: "quality", points: 10 }],
				}),
			).rejects.toThrow(ForbiddenException);
		});

		it("aggregates and auto-grades once enough peers have reviewed", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Auto grade",
					orderIndex: 1,
					gradingType: "peer_review",
					peerReviewCount: 1,
					passMark: 70,
					rubricJson: [{ id: "quality", label: "Quality", maxPoints: 10 }],
				},
			});
			const author = await createUser(prisma, { role: "learner" });
			const submission = await prisma.projectSubmission.create({
				data: { projectId: project.id, userId: author.id, textContent: "Work" },
			});
			const review = await prisma.projectPeerReview.create({
				data: { submissionId: submission.id, reviewerUserId: learnerId },
			});
			await service.submitReview(asAuthenticatedUser(learnerId), review.id, {
				rubricScores: [{ criterionId: "quality", points: 8 }],
			});
			const graded = await prisma.projectSubmission.findUnique({
				where: { id: submission.id },
			});
			expect(graded?.gradedAt).not.toBeNull();
			expect(Number(graded?.score)).toBe(80); // 8/10 -> 80%
			expect(graded?.passed).toBe(true);

			// Aggregation is the grading moment → exactly one ProjectGraded,
			// addressed to the submission's AUTHOR, not the reviewer (Phase 4, §6.4).
			const events2 = emitted.filter(
				(e) => e.event === LearningEvents.ProjectGraded,
			);
			expect(events2).toHaveLength(1);
			expect(events2[0].payload).toMatchObject({
				userId: author.id,
				projectId: project.id,
				submissionId: submission.id,
				score: 80,
				passed: true,
			});
		});

		it("clamps rubric points to the criterion's maxPoints", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Clamp",
					orderIndex: 1,
					gradingType: "peer_review",
					peerReviewCount: 1,
					rubricJson: [{ id: "quality", label: "Quality", maxPoints: 10 }],
				},
			});
			const author = await createUser(prisma, { role: "learner" });
			const submission = await prisma.projectSubmission.create({
				data: { projectId: project.id, userId: author.id, textContent: "Work" },
			});
			const review = await prisma.projectPeerReview.create({
				data: { submissionId: submission.id, reviewerUserId: learnerId },
			});
			await service.submitReview(asAuthenticatedUser(learnerId), review.id, {
				rubricScores: [{ criterionId: "quality", points: 999 }],
			});
			const graded = await prisma.projectSubmission.findUnique({
				where: { id: submission.id },
			});
			expect(Number(graded?.score)).toBe(100); // clamped to 10/10
		});
	});

	// ── A project only opens once the course work is done (§4.3) ────────────
	describe("prerequisite gate", () => {
		async function courseWithProject(slug: string) {
			const course = await prisma.course.create({
				data: { title: "C", slug, createdBy: learnerId },
			});
			const mod = await createModule(prisma, course.id);
			const lesson = await createLesson(prisma, mod.id, {
				contentType: "video",
				minVideoWatchPct: 90,
			});
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Capstone",
					orderIndex: 1,
					courseId: course.id,
				},
			});
			return { course, lesson, project };
		}

		it("refuses a submission while lessons are unfinished", async () => {
			const { project } = await courseWithProject("proj-gate-locked");

			await expect(
				service.submit(asAuthenticatedUser(learnerId), project.id, {
					textContent: "Early",
				}),
			).rejects.toMatchObject({
				response: { details: { reason: "prerequisites" } },
			});
			// Nothing was written.
			expect(
				await prisma.projectSubmission.count({
					where: { projectId: project.id },
				}),
			).toBe(0);
		});

		it("reports the lock on the learner's project info", async () => {
			const { project } = await courseWithProject("proj-gate-info");
			const info = await service.getProjectInfo(
				asAuthenticatedUser(learnerId),
				project.id,
			);
			expect(info.prerequisitesMet).toBe(false);
		});

		it("accepts the submission once every lesson is done", async () => {
			const { lesson, project } = await courseWithProject("proj-gate-open");
			await prisma.lessonCompletion.create({
				data: { userId: learnerId, lessonId: lesson.id, videoWatchedPct: 95 },
			});

			const info = await service.getProjectInfo(
				asAuthenticatedUser(learnerId),
				project.id,
			);
			expect(info.prerequisitesMet).toBe(true);

			const result = await service.submit(
				asAuthenticatedUser(learnerId),
				project.id,
				{ textContent: "My capstone" },
			);
			expect(result.attemptNumber).toBe(1);
		});
	});

	// ── Retry policy (§4.5) ─────────────────────────────────────────────────
	describe("retry policy", () => {
		/** A graded, failed attempt `hoursAgo` in the past. */
		async function failedAttempt(
			projectId: string,
			userId: string,
			attemptNumber: number,
			hoursAgo: number,
		) {
			const when = new Date(Date.now() - hoursAgo * 3_600_000);
			return prisma.projectSubmission.create({
				data: {
					projectId,
					userId,
					attemptNumber,
					textContent: "Attempt",
					submittedAt: when,
					gradedAt: when,
					score: 10,
					passed: false,
				},
			});
		}

		it("blocks a new attempt once maxAttempts is used up (no lockout reset)", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Two tries",
					orderIndex: 1,
					maxAttempts: 2,
				},
			});
			await failedAttempt(project.id, learnerId, 1, 48);
			await failedAttempt(project.id, learnerId, 2, 24);

			await expect(
				service.submit(asAuthenticatedUser(learnerId), project.id, {
					textContent: "Third try",
				}),
			).rejects.toMatchObject({
				response: { details: { reason: "no_attempts_left" } },
			});
		});

		it("enforces the spacing cooldown between attempts", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Spaced",
					orderIndex: 1,
					maxAttempts: 3,
					retryCooldownHours: 24,
				},
			});
			await failedAttempt(project.id, learnerId, 1, 2); // graded 2h ago

			await expect(
				service.submit(asAuthenticatedUser(learnerId), project.id, {
					textContent: "Too soon",
				}),
			).rejects.toMatchObject({
				response: { details: { reason: "cooldown" } },
			});
		});

		it("allows the next attempt once the spacing cooldown has elapsed", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Spacing elapsed",
					orderIndex: 1,
					maxAttempts: 3,
					retryCooldownHours: 6,
				},
			});
			await failedAttempt(project.id, learnerId, 1, 8); // graded 8h ago

			const result = await service.submit(
				asAuthenticatedUser(learnerId),
				project.id,
				{ textContent: "On time" },
			);
			expect(result.attemptNumber).toBe(2);
		});

		it("locks out after exhausting attempts, then resets the allowance once the lockout elapses", async () => {
			const locked = await prisma.project.create({
				data: {
					scope: "course",
					title: "Locked",
					orderIndex: 1,
					maxAttempts: 2,
					retryLockoutDays: 14,
				},
			});
			await failedAttempt(locked.id, learnerId, 1, 48);
			await failedAttempt(locked.id, learnerId, 2, 24); // exhausted 1 day ago
			await expect(
				service.submit(asAuthenticatedUser(learnerId), locked.id, {
					textContent: "Still locked",
				}),
			).rejects.toMatchObject({
				response: { details: { reason: "locked_out" } },
			});

			// Same policy, but the lockout has long since elapsed → fresh window.
			const reset = await prisma.project.create({
				data: {
					scope: "course",
					title: "Reset",
					orderIndex: 1,
					maxAttempts: 2,
					retryLockoutDays: 14,
				},
			});
			const learner2 = (await createUser(prisma, { role: "learner" })).id;
			await failedAttempt(reset.id, learner2, 1, 24 * 40);
			await failedAttempt(reset.id, learner2, 2, 24 * 30); // 30 days ago > 14d
			const result = await service.submit(
				asAuthenticatedUser(learner2),
				reset.id,
				{ textContent: "Fresh window" },
			);
			expect(result.attemptNumber).toBe(3);
		});

		it("lets an ungraded draft be re-sent without consuming an attempt", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Draft edit",
					orderIndex: 1,
					maxAttempts: 1,
					retryCooldownHours: 24,
				},
			});
			await service.submit(asAuthenticatedUser(learnerId), project.id, {
				textContent: "First",
			});
			// Re-sending the still-ungraded draft is an edit, not a new attempt.
			const again = await service.submit(
				asAuthenticatedUser(learnerId),
				project.id,
				{ textContent: "Revised" },
			);
			expect(again.attemptNumber).toBe(1);
			expect(again.textContent).toBe("Revised");
		});

		it("reports retry state on the learner's project info", async () => {
			const project = await prisma.project.create({
				data: {
					scope: "course",
					title: "Info",
					orderIndex: 1,
					maxAttempts: 3,
					retryCooldownHours: 24,
					retryLockoutDays: 7,
				},
			});
			await failedAttempt(project.id, learnerId, 1, 2);

			const info = await service.getProjectInfo(
				asAuthenticatedUser(learnerId),
				project.id,
			);
			expect(info.maxAttempts).toBe(3);
			expect(info.retry.attemptsUsed).toBe(1);
			expect(info.retry.attemptsRemaining).toBe(2);
			expect(info.retry.canRetry).toBe(false); // still inside the 24h spacing
			expect(info.retry.reason).toBe("cooldown");
			expect(info.retry.nextAttemptAt).toBeTruthy();
		});
	});
});
