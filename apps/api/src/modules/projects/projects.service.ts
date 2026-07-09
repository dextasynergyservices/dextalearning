import { randomBytes } from "node:crypto";
import {
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type {
	Project,
	ProjectSubmission,
} from "../../../generated/prisma/client";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AI_PORT, type AiPort, type RubricItem } from "../../shared/ai/ai.port";
import {
	LearningEvents,
	type ProjectGradedEvent,
} from "../../shared/events/learning-events";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import type {
	CreateProjectDto,
	ProjectScopeDto,
	RubricCriterionDto,
	UpdateProjectDto,
} from "./dto/projects.dto";
import type { GradeSubmissionDto } from "./dto/submissions.dto";

interface SubmissionFile {
	key: string;
	name: string;
}

interface ParentRef {
	courseId?: string;
	pathId?: string;
	cohortId?: string;
}

const SCOPE_PARENT_KEY: Record<ProjectScopeDto, keyof ParentRef> = {
	course: "courseId",
	path: "pathId",
	cohort: "cohortId",
};

/** Project authoring (§4.5). Course/path = owning instructor or admin; cohort = admin. */
@Injectable()
export class ProjectsService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
		@Inject(AI_PORT) private readonly ai: AiPort,
		private readonly events: EventEmitter2,
	) {}

	private async assertCanManage(user: AuthenticatedUser, parent: ParentRef) {
		if (parent.cohortId) {
			if (user.role !== "admin") {
				throw new ForbiddenException("Cohort projects are admin-only");
			}
			const cohort = await this.prisma.cohort.findUnique({
				where: { id: parent.cohortId },
				select: { id: true },
			});
			if (!cohort) throw new NotFoundException("Cohort not found");
			return;
		}
		let createdBy: string | null = null;
		if (parent.courseId) {
			const course = await this.prisma.course.findUnique({
				where: { id: parent.courseId },
				select: { createdBy: true },
			});
			if (!course) throw new NotFoundException("Course not found");
			createdBy = course.createdBy;
		} else if (parent.pathId) {
			const path = await this.prisma.learningPath.findUnique({
				where: { id: parent.pathId },
				select: { createdBy: true },
			});
			if (!path) throw new NotFoundException("Path not found");
			createdBy = path.createdBy;
		} else {
			throw new BadRequestException("No parent specified for the project");
		}
		if (user.role === "admin" || createdBy === user.id) return;
		throw new ForbiddenException("You do not own this content");
	}

	private async loadOwned(user: AuthenticatedUser, id: string) {
		const project = await this.prisma.project.findUnique({ where: { id } });
		if (!project) throw new NotFoundException("Project not found");
		await this.assertCanManage(user, {
			courseId: project.courseId ?? undefined,
			pathId: project.pathId ?? undefined,
			cohortId: project.cohortId ?? undefined,
		});
		return project;
	}

	private scopeParent(dto: CreateProjectDto): ParentRef {
		const key = SCOPE_PARENT_KEY[dto.scope];
		const id = dto[key];
		if (!id) {
			throw new BadRequestException(
				`${key} is required for scope "${dto.scope}"`,
			);
		}
		return { [key]: id };
	}

	/** Decimal `passMark` → number for clean JSON. */
	private present<T extends { passMark: unknown }>(project: T) {
		return { ...project, passMark: Number(project.passMark) };
	}

	private normalizeRubric(rubric?: RubricCriterionDto[]) {
		if (!rubric) return undefined;
		return rubric.map((r) => ({
			id: r.id || randomBytes(4).toString("hex"),
			label: r.label,
			maxPoints: r.maxPoints,
			description: r.description ?? null,
		}));
	}

	async createProject(user: AuthenticatedUser, dto: CreateProjectDto) {
		const parent = this.scopeParent(dto);
		await this.assertCanManage(user, parent);
		const last = await this.prisma.project.aggregate({
			where: parent,
			_max: { orderIndex: true },
		});
		const created = await this.prisma.project.create({
			data: {
				scope: dto.scope,
				title: dto.title,
				...parent,
				orderIndex: (last._max.orderIndex ?? 0) + 1,
				tenantId: user.tenantId ?? null,
				createdBy: user.id,
			},
		});
		return this.present(created);
	}

	async listForParent(user: AuthenticatedUser, parent: ParentRef) {
		if (!Object.values(parent).some(Boolean)) {
			throw new BadRequestException("Provide one parent id to list projects");
		}
		await this.assertCanManage(user, parent);
		const projects = await this.prisma.project.findMany({
			where: {
				courseId: parent.courseId ?? undefined,
				pathId: parent.pathId ?? undefined,
				cohortId: parent.cohortId ?? undefined,
			},
			orderBy: { orderIndex: "asc" },
			include: { _count: { select: { submissions: true } } },
		});
		return projects.map((p) => this.present(p));
	}

	async getForEdit(user: AuthenticatedUser, id: string) {
		const project = await this.loadOwned(user, id);
		return this.present(project);
	}

	async updateProject(
		user: AuthenticatedUser,
		id: string,
		dto: UpdateProjectDto,
	) {
		await this.loadOwned(user, id);
		const { dueAt, rubric, ...rest } = dto;
		const updated = await this.prisma.project.update({
			where: { id },
			data: {
				...rest,
				...(dueAt !== undefined
					? { dueAt: dueAt ? new Date(dueAt) : null }
					: {}),
				...(rubric !== undefined
					? { rubricJson: this.normalizeRubric(rubric) }
					: {}),
			},
		});
		return this.present(updated);
	}

	async deleteProject(user: AuthenticatedUser, id: string) {
		await this.loadOwned(user, id);
		await this.prisma.project.delete({ where: { id } });
		return { deleted: true };
	}

	// ── Grading (§4.5 — instructor/admin) ─────────────────────────────────────
	private rubricOf(project: Project): RubricItem[] {
		return Array.isArray(project.rubricJson)
			? (project.rubricJson as unknown as RubricItem[])
			: [];
	}

	private filesOf(sub: ProjectSubmission): SubmissionFile[] {
		return Array.isArray(sub.fileKeysJson)
			? (sub.fileKeysJson as unknown as SubmissionFile[])
			: [];
	}

	private async loadOwnedSubmission(
		user: AuthenticatedUser,
		submissionId: string,
	) {
		const submission = await this.prisma.projectSubmission.findUnique({
			where: { id: submissionId },
			include: { project: true },
		});
		const project = submission?.project;
		if (!submission || !project) {
			throw new NotFoundException("Submission not found");
		}
		await this.assertCanManage(user, {
			courseId: project.courseId ?? undefined,
			pathId: project.pathId ?? undefined,
			cohortId: project.cohortId ?? undefined,
		});
		return { submission, project };
	}

	async listSubmissions(user: AuthenticatedUser, projectId: string) {
		await this.loadOwned(user, projectId);
		const subs = await this.prisma.projectSubmission.findMany({
			where: { projectId },
			include: { user: { select: { name: true, email: true } } },
			orderBy: [{ gradedAt: "asc" }, { submittedAt: "desc" }],
		});
		return subs.map((s) => ({
			id: s.id,
			attemptNumber: s.attemptNumber,
			userName: s.user?.name ?? null,
			userEmail: s.user?.email ?? null,
			submittedAt: s.submittedAt,
			graded: s.gradedAt != null,
			score: s.score == null ? null : Number(s.score),
			passed: s.passed,
		}));
	}

	async getSubmissionForGrading(user: AuthenticatedUser, submissionId: string) {
		const { submission: sub, project } = await this.loadOwnedSubmission(
			user,
			submissionId,
		);
		const files = await Promise.all(
			this.filesOf(sub).map(async (f) => ({
				name: f.name,
				url: await this.storage.getSignedDownloadUrl(f.key),
			})),
		);
		const learner = sub.userId
			? await this.prisma.user.findUnique({
					where: { id: sub.userId },
					select: { name: true, email: true },
				})
			: null;
		return {
			id: sub.id,
			attemptNumber: sub.attemptNumber,
			userName: learner?.name ?? null,
			userEmail: learner?.email ?? null,
			submittedAt: sub.submittedAt,
			textContent: sub.textContent,
			urlSubmission: sub.urlSubmission,
			files,
			projectId: project.id,
			projectTitle: project.title,
			brief: project.description,
			gradingType: project.gradingType,
			passMark: Number(project.passMark),
			rubric: this.rubricOf(project),
			graded: sub.gradedAt != null,
			score: sub.score == null ? null : Number(sub.score),
			passed: sub.passed,
			feedback: sub.feedback,
			rubricScores: sub.rubricScoresJson,
		};
	}

	async aiDraftGrade(user: AuthenticatedUser, submissionId: string) {
		const { submission: sub, project } = await this.loadOwnedSubmission(
			user,
			submissionId,
		);
		const parts: string[] = [];
		if (sub.textContent) parts.push(sub.textContent);
		if (sub.urlSubmission) parts.push(`URL: ${sub.urlSubmission}`);
		const fileNames = this.filesOf(sub).map((f) => f.name);
		if (fileNames.length > 0) parts.push(`Files: ${fileNames.join(", ")}`);
		const submission = parts.join("\n\n");
		if (!submission.trim()) {
			throw new BadRequestException("There is nothing to grade yet.");
		}
		return this.ai.gradeProjectDraft({
			brief: project.description ?? "",
			rubric: this.rubricOf(project),
			submission,
		});
	}

	async gradeSubmission(
		user: AuthenticatedUser,
		submissionId: string,
		dto: GradeSubmissionDto,
	) {
		const { submission, project } = await this.loadOwnedSubmission(
			user,
			submissionId,
		);
		const firstGrade = submission.gradedAt == null;
		const rubric = this.rubricOf(project);
		let score = dto.score;
		let rubricScores: { criterionId: string; points: number }[] | undefined;

		if (dto.rubricScores && dto.rubricScores.length > 0) {
			const byId = new Map(rubric.map((r) => [r.id, r]));
			rubricScores = [];
			for (const s of dto.rubricScores) {
				const crit = byId.get(s.criterionId);
				if (!crit) continue;
				rubricScores.push({
					criterionId: s.criterionId,
					points: Math.max(0, Math.min(crit.maxPoints, s.points)),
				});
			}
			const total = rubric.reduce((sum, r) => sum + r.maxPoints, 0);
			const earned = rubricScores.reduce((sum, s) => sum + s.points, 0);
			if (dto.score == null && total > 0) {
				score = Math.round((earned / total) * 10_000) / 100;
			}
		}

		const passMark = Number(project.passMark);
		const passed = dto.passed ?? (score != null ? score >= passMark : false);
		const updated = await this.prisma.projectSubmission.update({
			where: { id: submissionId },
			data: {
				score: score ?? null,
				passed,
				feedback: dto.feedback ?? null,
				...(rubricScores ? { rubricScoresJson: rubricScores } : {}),
				gradedBy: user.id,
				gradedAt: new Date(),
			},
		});
		// Emit only on the FIRST grade — regrades adjust the record without
		// re-firing downstream engagement/notification effects (§6.4).
		if (firstGrade && submission.userId && submission.projectId) {
			this.events.emit(LearningEvents.ProjectGraded, {
				userId: submission.userId,
				projectId: submission.projectId,
				submissionId: updated.id,
				score: updated.score == null ? null : Number(updated.score),
				passed,
			} satisfies ProjectGradedEvent);
		}
		return {
			id: updated.id,
			score: updated.score == null ? null : Number(updated.score),
			passed: updated.passed,
			gradedAt: updated.gradedAt,
		};
	}
}
