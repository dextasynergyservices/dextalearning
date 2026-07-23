import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
	Project,
	ProjectSubmission,
} from "../../../generated/prisma/client";
import type { AuthenticatedUser } from "../../auth/types";
import { renderNotificationEmail } from "../../emails/render";
import { PrismaService } from "../../prisma/prisma.service";
import {
	LearningEvents,
	type ProjectGradedEvent,
} from "../../shared/events/learning-events";
import {
	computeRetryState,
	type RetryBlockReason,
} from "../../shared/retry/retry-policy.calculator";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import { CompletionService } from "../completion/completion.service";
import { extensionOf, type UploadFile } from "../media/media.constants";
import { NotificationsService } from "../notifications/notifications.service";

interface SubmissionFile {
	key: string;
	name: string;
}

/** Fallback copy — the client localizes off `details.reason` (§8 i18n). */
const RETRY_MESSAGES: Record<RetryBlockReason, string> = {
	already_passed: "You have already passed this project.",
	no_attempts_left: "You have used all your attempts for this project.",
	cooldown: "You need to wait a little longer before your next attempt.",
	locked_out:
		"You have used all your attempts. You can try again once the cooldown ends.",
};

/** Learner-facing project submission (§4.5): text / URL / file deliverables. */
@Injectable()
export class SubmissionsService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
		private readonly events: EventEmitter2,
		private readonly completion: CompletionService,
		private readonly notifications: NotificationsService,
	) {}

	private filesOf(sub: ProjectSubmission): SubmissionFile[] {
		return Array.isArray(sub.fileKeysJson)
			? (sub.fileKeysJson as unknown as SubmissionFile[])
			: [];
	}

	/** Learner view of a submission — feedback/score only once graded. */
	private async present(sub: ProjectSubmission) {
		const files = await Promise.all(
			this.filesOf(sub).map(async (f) => ({
				name: f.name,
				url: await this.storage.getSignedDownloadUrl(f.key),
			})),
		);
		const graded = sub.gradedAt != null;
		return {
			id: sub.id,
			attemptNumber: sub.attemptNumber,
			submittedAt: sub.submittedAt,
			textContent: sub.textContent,
			urlSubmission: sub.urlSubmission,
			files,
			graded,
			score: graded && sub.score != null ? Number(sub.score) : null,
			passed: sub.passed,
			feedback: graded ? sub.feedback : null,
			peerReviewsAssigned: sub.peerReviewsAssigned,
			peerReviewsCompleted: sub.peerReviewsCompleted,
		};
	}

	/**
	 * Retry state for a learner on a project (§4.5). Only *graded* submissions
	 * consume an attempt — an ungraded one is still an editable draft — and the
	 * clock runs from `gradedAt`, the moment the learner learned they'd failed.
	 */
	private async retryStateFor(
		userId: string,
		project: Pick<
			Project,
			"id" | "maxAttempts" | "retryCooldownHours" | "retryLockoutDays"
		>,
	) {
		const graded = await this.prisma.projectSubmission.findMany({
			where: { projectId: project.id, userId, gradedAt: { not: null } },
			select: { gradedAt: true, passed: true },
		});
		return computeRetryState(
			graded.map((s) => ({
				submittedAt: s.gradedAt as Date,
				passed: s.passed === true,
			})),
			{
				maxAttempts: project.maxAttempts ?? null,
				spacingHours: project.retryCooldownHours ?? null,
				lockoutDays: project.retryLockoutDays ?? null,
			},
		);
	}

	/**
	 * Is the project open yet (§4.3)? Like a final assessment, a project is the
	 * summative work — it only unlocks once the material it draws on is done.
	 * Asked of the Completion context rather than re-derived here (§6.4).
	 */
	private async prerequisitesMet(
		user: AuthenticatedUser,
		project: Pick<Project, "courseId" | "pathId" | "cohortId">,
	): Promise<boolean> {
		const parent = project.courseId
			? (["course", project.courseId] as const)
			: project.pathId
				? (["path", project.pathId] as const)
				: project.cohortId
					? (["cohort", project.cohortId] as const)
					: null;
		if (!parent) return true;
		const { unlocked } = await this.completion.getFinalsGate(
			user,
			parent[0],
			parent[1],
		);
		return unlocked;
	}

	async getProjectInfo(user: AuthenticatedUser, projectId: string) {
		const project = await this.prisma.project.findUnique({
			where: { id: projectId },
		});
		if (!project) throw new NotFoundException("Project not found");
		const prerequisitesMet = await this.prerequisitesMet(user, project);
		const mine = await this.prisma.projectSubmission.findFirst({
			where: { projectId, userId: user.id },
			orderBy: { submittedAt: "desc" },
		});
		const retry = await this.retryStateFor(user.id, project);
		// Peer-review obligation (§4.5): the learner must complete assigned reviews.
		let peerReview: { required: number; completed: number } | null = null;
		if (project.gradingType === "peer_review") {
			const completed = await this.prisma.projectPeerReview.count({
				where: {
					reviewerUserId: user.id,
					submittedAt: { not: null },
					submission: { projectId },
				},
			});
			peerReview = { required: project.peerReviewCount, completed };
		}
		return {
			peerReview,
			id: project.id,
			title: project.title,
			description: project.description,
			scope: project.scope,
			submissionTypes: project.submissionTypes,
			// The language + starter code for a `code` submission (null otherwise).
			codeConfig: project.codeConfigJson ?? null,
			gradingType: project.gradingType,
			passMark: Number(project.passMark),
			dueAt: project.dueAt,
			maxFileSizeMb: project.maxFileSizeMb,
			allowedFileTypes: project.allowedFileTypes,
			peerReviewCount: project.peerReviewCount,
			rubric: project.rubricJson,
			mySubmission: mine ? await this.present(mine) : null,
			/** False while the course/path/cohort work is unfinished (§4.3). */
			prerequisitesMet,
			// Retry policy (§4.5) — the creator's rules plus this learner's state.
			maxAttempts: project.maxAttempts,
			retryCooldownHours: project.retryCooldownHours,
			retryLockoutDays: project.retryLockoutDays,
			retry: {
				attemptsUsed: retry.attemptsUsed,
				attemptsRemaining: retry.attemptsRemaining,
				canRetry: retry.canRetry,
				reason: retry.reason ?? null,
				nextAttemptAt: retry.nextAttemptAt,
				lockedUntil: retry.lockedUntil,
			},
		};
	}

	async uploadFile(
		user: AuthenticatedUser,
		projectId: string,
		file: UploadFile,
	) {
		const project = await this.prisma.project.findUnique({
			where: { id: projectId },
			select: {
				submissionTypes: true,
				allowedFileTypes: true,
				maxFileSizeMb: true,
			},
		});
		if (!project) throw new NotFoundException("Project not found");
		if (!project.submissionTypes.includes("file_upload")) {
			throw new BadRequestException(
				"This project does not accept file uploads.",
			);
		}
		const ext = extensionOf(file.originalname);
		if (
			project.allowedFileTypes.length > 0 &&
			!project.allowedFileTypes.includes(ext)
		) {
			throw new UnprocessableEntityException({
				code: "FILE_TYPE_NOT_ALLOWED",
				message: `Allowed types: ${project.allowedFileTypes.join(", ")}`,
			});
		}
		if (file.size > project.maxFileSizeMb * 1024 * 1024) {
			throw new UnprocessableEntityException({
				code: "FILE_TOO_LARGE",
				message: `File must be ${project.maxFileSizeMb} MB or smaller.`,
			});
		}
		const safe = file.originalname.replace(/[^\w.-]+/g, "_").slice(0, 80);
		const key = `projects/${projectId}/submissions/${user.id}/${Date.now()}-${safe}`;
		await this.storage.putObject(key, file.buffer, file.mimetype);
		return {
			key,
			name: file.originalname,
			url: await this.storage.getSignedDownloadUrl(key),
		};
	}

	async submit(
		user: AuthenticatedUser,
		projectId: string,
		dto: {
			textContent?: string;
			urlSubmission?: string;
			files?: SubmissionFile[];
		},
	) {
		const project = await this.prisma.project.findUnique({
			where: { id: projectId },
			select: {
				id: true,
				title: true,
				maxAttempts: true,
				retryCooldownHours: true,
				retryLockoutDays: true,
				courseId: true,
				pathId: true,
				cohortId: true,
				createdBy: true,
				gradingType: true,
			},
		});
		if (!project) throw new NotFoundException("Project not found");

		// The project is summative — it stays shut until the material is done
		// (§4.3). Checked before anything is written.
		if (!(await this.prerequisitesMet(user, project))) {
			throw new UnprocessableEntityException({
				code: "PREREQUISITES_NOT_MET",
				message:
					"Finish all the lessons and module quizzes before submitting your project.",
				details: { reason: "prerequisites" },
			});
		}

		const hasText = !!dto.textContent?.trim();
		const hasUrl = !!dto.urlSubmission?.trim();
		const hasFiles = (dto.files?.length ?? 0) > 0;
		if (!hasText && !hasUrl && !hasFiles) {
			throw new BadRequestException("Add your submission before sending it.");
		}

		const latest = await this.prisma.projectSubmission.findFirst({
			where: { projectId, userId: user.id },
			orderBy: { submittedAt: "desc" },
		});
		if (latest?.passed === true) {
			throw new ConflictException("You have already passed this project.");
		}

		// Retry policy (§4.5). An ungraded submission is still an editable draft,
		// so it costs nothing to re-send; only *starting a fresh attempt* after a
		// graded failure is gated.
		const startsNewAttempt = !latest || latest.gradedAt != null;
		if (startsNewAttempt) {
			const retry = await this.retryStateFor(user.id, project);
			if (!retry.canRetry) {
				throw new UnprocessableEntityException({
					code: "RETRY_NOT_ALLOWED",
					message: RETRY_MESSAGES[retry.reason ?? "no_attempts_left"],
					details: {
						reason: retry.reason,
						attemptsRemaining: retry.attemptsRemaining,
						nextAttemptAt: retry.nextAttemptAt,
						lockedUntil: retry.lockedUntil,
					},
				});
			}
		}

		const data = {
			textContent: dto.textContent?.trim() || null,
			urlSubmission: dto.urlSubmission?.trim() || null,
			fileKeysJson: (dto.files ?? []) as object,
			submittedAt: new Date(),
		};

		// Reuse the current draft while it's ungraded; otherwise start a new attempt.
		const submission =
			latest && latest.gradedAt == null
				? await this.prisma.projectSubmission.update({
						where: { id: latest.id },
						data,
					})
				: await this.prisma.projectSubmission.create({
						data: {
							projectId,
							userId: user.id,
							attemptNumber: (latest?.attemptNumber ?? 0) + 1,
							...data,
						},
					});

		// Tell the creator there's something to grade (§4.5) — only on a fresh
		// attempt, since re-sending an ungraded draft is the same pending work
		// they were already told about. Never fails the learner's submission.
		if (startsNewAttempt) {
			await this.notifyCreatorOfSubmission(user, project).catch(() => {});
		}
		return this.present(submission);
	}

	/**
	 * "You have a submission to grade." Goes to the project's **creator** — the
	 * only person who can grade it (§4.5) — not the course owner. Peer-reviewed
	 * projects are graded by peers, so there is nothing to ping about.
	 */
	private async notifyCreatorOfSubmission(
		learner: AuthenticatedUser,
		project: Pick<Project, "id" | "title" | "createdBy" | "gradingType">,
	): Promise<void> {
		if (!project.createdBy || project.gradingType === "peer_review") return;
		const [creator, submitter] = await Promise.all([
			this.prisma.user.findUnique({
				where: { id: project.createdBy },
				select: { email: true },
			}),
			this.prisma.user.findUnique({
				where: { id: learner.id },
				select: { name: true },
			}),
		]);
		if (!creator) return;
		const learnerName = submitter?.name ?? "A learner";
		await this.notifications.notify(project.createdBy, {
			type: "project_submission_received",
			dataJson: {
				projectId: project.id,
				projectTitle: project.title,
				learnerName,
			},
			inApp: true,
			email: {
				to: creator.email,
				subject: `New submission to grade — ${project.title}`,
				html: await renderNotificationEmail({
					preview: `${learnerName} submitted ${project.title}`,
					heading: "New submission to grade",
					paragraphs: [
						`${learnerName} submitted ${project.title} for grading.`,
						"Until it's graded they can't complete the course — so their certificate and Earn-Back are waiting on you.",
					],
					cta: "Grade it now",
					ctaUrl: `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/instructor/project-submissions/${project.id}`,
				}),
			},
		});
	}

	// ── Peer review (§4.5) ────────────────────────────────────────────────────
	private rubricScoresOf(
		json: unknown,
	): { criterionId: string; points: number }[] {
		return Array.isArray(json)
			? (json as { criterionId: string; points: number }[])
			: [];
	}

	/** Assigned peer reviews for this learner (lazily assigns up to peerReviewCount). */
	async listMyReviews(user: AuthenticatedUser, projectId: string) {
		const project = await this.prisma.project.findUnique({
			where: { id: projectId },
		});
		if (!project) throw new NotFoundException("Project not found");
		if (project.gradingType !== "peer_review") {
			throw new BadRequestException("This project is not peer-reviewed.");
		}
		const required = project.peerReviewCount;
		let assignments = await this.prisma.projectPeerReview.findMany({
			where: { reviewerUserId: user.id, submission: { projectId } },
			include: { submission: true },
			orderBy: { createdAt: "asc" },
		});
		if (assignments.length < required) {
			const have = assignments
				.map((a) => a.submissionId)
				.filter((id): id is string => !!id);
			const candidates = await this.prisma.projectSubmission.findMany({
				where: { projectId, userId: { not: user.id }, id: { notIn: have } },
				orderBy: { peerReviewsAssigned: "asc" },
				take: required - assignments.length,
			});
			for (const candidate of candidates) {
				const created = await this.prisma.projectPeerReview.create({
					data: { submissionId: candidate.id, reviewerUserId: user.id },
					include: { submission: true },
				});
				await this.prisma.projectSubmission.update({
					where: { id: candidate.id },
					data: { peerReviewsAssigned: { increment: 1 } },
				});
				assignments = [...assignments, created];
			}
		}

		const reviews = await Promise.all(
			assignments.map(async (a, i) => {
				const sub = a.submission;
				const files = sub
					? await Promise.all(
							this.filesOf(sub).map(async (f) => ({
								name: f.name,
								url: await this.storage.getSignedDownloadUrl(f.key),
							})),
						)
					: [];
				return {
					reviewId: a.id,
					label: `#${i + 1}`,
					textContent: sub?.textContent ?? null,
					urlSubmission: sub?.urlSubmission ?? null,
					files,
					done: a.submittedAt != null,
					myScores: this.rubricScoresOf(a.rubricScoresJson),
					myFeedback: a.feedback ?? null,
				};
			}),
		);
		return {
			projectId,
			projectTitle: project.title,
			rubric: project.rubricJson,
			passMark: Number(project.passMark),
			required,
			completed: assignments.filter((a) => a.submittedAt != null).length,
			reviews,
		};
	}

	async submitReview(
		user: AuthenticatedUser,
		reviewId: string,
		dto: {
			rubricScores?: { criterionId: string; points: number }[];
			feedback?: string;
		},
	) {
		const review = await this.prisma.projectPeerReview.findUnique({
			where: { id: reviewId },
			include: { submission: { include: { project: true } } },
		});
		if (!review || review.reviewerUserId !== user.id) {
			throw new ForbiddenException("This review is not assigned to you.");
		}
		const sub = review.submission;
		const project = sub?.project;
		if (!sub || !project) throw new NotFoundException("Submission not found");

		const rubric = Array.isArray(project.rubricJson)
			? (project.rubricJson as unknown as { id: string; maxPoints: number }[])
			: [];
		const byId = new Map(rubric.map((r) => [r.id, r]));
		const scores: { criterionId: string; points: number }[] = [];
		for (const s of dto.rubricScores ?? []) {
			const crit = byId.get(s.criterionId);
			if (!crit) continue;
			scores.push({
				criterionId: s.criterionId,
				points: Math.max(0, Math.min(crit.maxPoints, s.points)),
			});
		}

		await this.prisma.projectPeerReview.update({
			where: { id: reviewId },
			data: {
				rubricScoresJson: scores,
				feedback: dto.feedback ?? null,
				submittedAt: new Date(),
			},
		});

		const completedReviews = await this.prisma.projectPeerReview.findMany({
			where: { submissionId: sub.id, submittedAt: { not: null } },
		});
		await this.prisma.projectSubmission.update({
			where: { id: sub.id },
			data: { peerReviewsCompleted: completedReviews.length },
		});

		// Aggregate once enough peers have reviewed (§4.5).
		if (
			completedReviews.length >= project.peerReviewCount &&
			sub.gradedAt == null
		) {
			const totalMax = rubric.reduce((s, r) => s + r.maxPoints, 0);
			const totals = completedReviews.map((r) =>
				this.rubricScoresOf(r.rubricScoresJson).reduce(
					(s, x) => s + x.points,
					0,
				),
			);
			const avgEarned =
				totals.reduce((s, x) => s + x, 0) / (totals.length || 1);
			const score =
				totalMax > 0 ? Math.round((avgEarned / totalMax) * 10_000) / 100 : 0;
			const passed = score >= Number(project.passMark);
			await this.prisma.projectSubmission.update({
				where: { id: sub.id },
				data: { score, passed, gradedAt: new Date() },
			});
			// First (and only) grading moment for a peer-reviewed submission —
			// the `gradedAt == null` guard above already prevents re-fires (§6.4).
			if (sub.userId && sub.projectId) {
				this.events.emit(LearningEvents.ProjectGraded, {
					userId: sub.userId,
					projectId: sub.projectId,
					submissionId: sub.id,
					score,
					passed,
				} satisfies ProjectGradedEvent);
			}
		}
		return { done: true };
	}
}
