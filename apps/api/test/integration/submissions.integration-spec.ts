import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "../../src/auth/types";
import { SubmissionsService } from "../../src/modules/projects/submissions.service";
import { getTestPrisma } from "./support/db";
import { createUser } from "./support/factories";
import { FakeStorageAdapter } from "./support/fakes/fake-storage.adapter";

function asAuthenticatedUser(id: string): AuthenticatedUser {
	return { id, email: `${id}@example.com`, role: "learner" };
}

describe("SubmissionsService (integration)", () => {
	const prisma = getTestPrisma();
	const service = new SubmissionsService(prisma, new FakeStorageAdapter());

	let learnerId: string;

	beforeEach(async () => {
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
});
