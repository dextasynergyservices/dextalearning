import {
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";

const LEARNER_SELECT = {
	id: true,
	name: true,
	firstName: true,
	lastName: true,
	email: true,
} as const;

function displayName(u: {
	name: string | null;
	firstName: string;
	lastName: string;
	email: string;
}): string {
	return u.name?.trim() || `${u.firstName} ${u.lastName}`.trim() || u.email;
}

/**
 * The "teaching" read-model for an **Instructor assigned to a cohort** (§Role
 * Definitions; cohort pricing note §2). Assignment makes the instructor the
 * cohort's subject-matter teacher (paid a manually-negotiated fee by Admin —
 * not automated). On the platform that grants them READ-ONLY visibility into
 * the cohort they teach: the roster + each learner's progress, so they can
 * monitor and support. It does NOT grant group management (facilitator's role)
 * or settings/commercials (admin's role). This context only reads; it writes
 * nothing.
 */
@Injectable()
export class TeachingService {
	constructor(private readonly prisma: PrismaService) {}

	/** Cohorts the current instructor is assigned to teach. */
	async myCohorts(user: AuthenticatedUser) {
		const links = await this.prisma.cohortInstructor.findMany({
			where: { userId: user.id },
			orderBy: { assignedAt: "desc" },
			select: {
				cohort: {
					select: {
						id: true,
						title: true,
						slug: true,
						status: true,
						startsAt: true,
						_count: { select: { enrollments: true, courses: true } },
					},
				},
			},
		});
		return links.map((l) => ({
			id: l.cohort.id,
			title: l.cohort.title,
			slug: l.cohort.slug,
			status: l.cohort.status,
			startsAt: l.cohort.startsAt,
			learnerCount: l.cohort._count.enrollments,
			courseCount: l.cohort._count.courses,
		}));
	}

	private async assertTeaches(user: AuthenticatedUser, cohortId: string) {
		if (user.role === "admin") return;
		const link = await this.prisma.cohortInstructor.findUnique({
			where: { cohortId_userId: { cohortId, userId: user.id } },
			select: { cohortId: true },
		});
		if (!link) {
			throw new ForbiddenException("You aren't assigned to teach this cohort.");
		}
	}

	/** Read-only overview of a cohort the instructor teaches: content + roster. */
	async cohortDetail(user: AuthenticatedUser, cohortId: string) {
		const cohort = await this.prisma.cohort.findUnique({
			where: { id: cohortId },
			select: {
				id: true,
				title: true,
				status: true,
				startsAt: true,
				endsAt: true,
				courses: {
					orderBy: { orderIndex: "asc" },
					select: { course: { select: { id: true, title: true } } },
				},
				paths: {
					select: { path: { select: { id: true, title: true } } },
				},
				_count: { select: { assessments: true, projects: true } },
			},
		});
		if (!cohort) throw new NotFoundException("Cohort not found");
		await this.assertTeaches(user, cohortId);

		const enrollments = await this.prisma.cohortEnrollment.findMany({
			where: { cohortId, NOT: { status: "dropped" } },
			orderBy: { enrolledAt: "asc" },
			select: { enrolledAt: true, user: { select: LEARNER_SELECT } },
		});
		const completion = await this.prisma.completionStatus.findMany({
			where: { entityType: "cohort", entityId: cohortId },
			select: { userId: true, progressPercent: true, isComplete: true },
		});
		const byUser = new Map(completion.map((c) => [c.userId, c]));

		return {
			id: cohort.id,
			title: cohort.title,
			status: cohort.status,
			startsAt: cohort.startsAt,
			endsAt: cohort.endsAt,
			courses: cohort.courses.map((cc) => ({
				id: cc.course.id,
				title: cc.course.title,
			})),
			paths: cohort.paths.map((cp) => ({
				id: cp.path.id,
				title: cp.path.title,
			})),
			assessmentCount: cohort._count.assessments,
			projectCount: cohort._count.projects,
			learners: enrollments.map((e) => ({
				userId: e.user.id,
				name: displayName(e.user),
				email: e.user.email,
				enrolledAt: e.enrolledAt,
				progressPercent: byUser.get(e.user.id)?.progressPercent ?? 0,
				completed: byUser.get(e.user.id)?.isComplete ?? false,
			})),
		};
	}
}
