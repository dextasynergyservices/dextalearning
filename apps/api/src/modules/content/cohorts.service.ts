import { randomBytes } from "node:crypto";
import {
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeCommercials } from "./commercials.calculator";
import type { CreateCohortDto, UpdateCohortDto } from "./dto/cohorts.dto";

const USER_SELECT = {
	id: true,
	name: true,
	email: true,
	role: true,
} as const;

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 180);
}

/** Cohort authoring (Admin only — §4.1): courses, schedule, grouping, staff. */
@Injectable()
export class CohortsService {
	constructor(private readonly prisma: PrismaService) {}

	private async uniqueSlug(title: string): Promise<string> {
		const base = slugify(title) || "cohort";
		const existing = await this.prisma.cohort.findUnique({
			where: { slug: base },
			select: { id: true },
		});
		return existing ? `${base}-${randomBytes(3).toString("hex")}` : base;
	}

	private async assertExists(cohortId: string) {
		const cohort = await this.prisma.cohort.findUnique({
			where: { id: cohortId },
			select: { id: true },
		});
		if (!cohort) throw new NotFoundException("Cohort not found");
	}

	private withPrice<T extends { price?: unknown }>(cohort: T) {
		return {
			...cohort,
			price: cohort.price == null ? null : Number(cohort.price),
		};
	}

	async createCohort(user: AuthenticatedUser, dto: CreateCohortDto) {
		return this.prisma.cohort.create({
			data: {
				title: dto.title,
				slug: await this.uniqueSlug(dto.title),
				description: dto.description,
				tenantId: user.tenantId ?? null,
				createdBy: user.id,
				status: "draft",
			},
		});
	}

	async listAll() {
		const cohorts = await this.prisma.cohort.findMany({
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				title: true,
				slug: true,
				status: true,
				startsAt: true,
				endsAt: true,
				capacity: true,
				seatsFilled: true,
				price: true,
				isFree: true,
				currency: true,
				isEarnBackEligible: true,
				earnBackPercentage: true,
				createdAt: true,
				_count: { select: { courses: true } },
			},
		});
		return cohorts.map((cohort) => this.withPrice(cohort));
	}

	async getForEdit(cohortId: string) {
		const cohort = await this.prisma.cohort.findUnique({
			where: { id: cohortId },
			include: {
				introLesson: {
					select: {
						id: true,
						contentType: true,
						videoKeysJson: true,
						audioKey: true,
						pdfKey: true,
						contentText: true,
					},
				},
				courses: {
					orderBy: { orderIndex: "asc" },
					include: {
						course: {
							select: { id: true, title: true, status: true, level: true },
						},
					},
				},
				paths: {
					orderBy: { orderIndex: "asc" },
					include: {
						path: {
							select: { id: true, title: true, status: true, level: true },
						},
					},
				},
				instructors: { include: { user: { select: USER_SELECT } } },
				facilitators: { include: { user: { select: USER_SELECT } } },
			},
		});
		if (!cohort) throw new NotFoundException("Cohort not found");

		const inCohort = new Set(cohort.courses.map((cc) => cc.courseId));
		const allCourses = await this.prisma.course.findMany({
			orderBy: { createdAt: "desc" },
			select: { id: true, title: true, status: true, level: true },
		});
		const availableCourses = allCourses.filter((c) => !inCohort.has(c.id));

		const inCohortPaths = new Set(cohort.paths.map((cp) => cp.pathId));
		const allPaths = await this.prisma.learningPath.findMany({
			orderBy: { createdAt: "desc" },
			select: { id: true, title: true, status: true, level: true },
		});
		const availablePaths = allPaths.filter((p) => !inCohortPaths.has(p.id));

		const assignedInstructorIds = new Set(
			cohort.instructors.map((ci) => ci.userId),
		);
		const assignedFacilitatorIds = new Set(
			cohort.facilitators.map((cf) => cf.userId),
		);
		// Instructors come from the instructor role; a facilitator, however, can be
		// ANY user the admin chooses (learner, instructor, even another admin) —
		// facilitation is a per-cohort assignment, not a global role (§4.7).
		const allUsers = await this.prisma.user.findMany({
			select: USER_SELECT,
			orderBy: { name: "asc" },
		});
		const assignableInstructors = allUsers.filter(
			(u) => u.role === "instructor" && !assignedInstructorIds.has(u.id),
		);
		const assignableFacilitators = allUsers.filter(
			(u) => !assignedFacilitatorIds.has(u.id),
		);

		return this.withPrice({
			...cohort,
			availableCourses,
			availablePaths,
			assignableInstructors,
			assignableFacilitators,
		});
	}

	/** Create (or return the existing) intro/preview lesson for a cohort. */
	async createIntro(cohortId: string) {
		await this.assertExists(cohortId);
		const existing = await this.prisma.lesson.findFirst({
			where: { introForCohortId: cohortId },
			select: { id: true },
		});
		if (existing) return { id: existing.id };
		const lesson = await this.prisma.lesson.create({
			data: {
				introForCohortId: cohortId,
				title: "Cohort intro",
				orderIndex: 0,
			},
			select: { id: true },
		});
		return { id: lesson.id };
	}

	async removeIntro(cohortId: string) {
		await this.assertExists(cohortId);
		await this.prisma.lesson.deleteMany({
			where: { introForCohortId: cohortId },
		});
		return { removed: true as const };
	}

	async updateCohort(cohortId: string, dto: UpdateCohortDto) {
		await this.assertExists(cohortId);
		const {
			price,
			isFree,
			currency,
			isEarnBackEligible,
			earnBackPercentage,
			startsAt,
			endsAt,
			...rest
		} = dto;
		const updated = await this.prisma.cohort.update({
			where: { id: cohortId },
			data: {
				...rest,
				...(startsAt !== undefined ? { startsAt: new Date(startsAt) } : {}),
				...(endsAt !== undefined ? { endsAt: new Date(endsAt) } : {}),
				...normalizeCommercials({
					price,
					isFree,
					currency,
					isEarnBackEligible,
					earnBackPercentage,
				}),
			},
		});
		return this.withPrice(updated);
	}

	async deleteCohort(cohortId: string) {
		await this.assertExists(cohortId);
		// `cohort_courses` has no cascade, so clear the course links first; the
		// instructor/facilitator links cascade on cohort delete.
		await this.prisma.$transaction([
			this.prisma.cohortCourse.deleteMany({ where: { cohortId } }),
			this.prisma.cohort.delete({ where: { id: cohortId } }),
		]);
		return { deleted: true };
	}

	async addCourse(cohortId: string, courseId: string) {
		await this.assertExists(cohortId);
		const course = await this.prisma.course.findUnique({
			where: { id: courseId },
			select: { id: true },
		});
		if (!course) throw new NotFoundException("Course not found");
		const last = await this.prisma.cohortCourse.aggregate({
			where: { cohortId },
			_max: { orderIndex: true },
		});
		await this.prisma.cohortCourse.create({
			data: { cohortId, courseId, orderIndex: (last._max.orderIndex ?? 0) + 1 },
		});
		return { added: true };
	}

	async removeCourse(cohortId: string, courseId: string) {
		await this.assertExists(cohortId);
		await this.prisma.cohortCourse.delete({
			where: { cohortId_courseId: { cohortId, courseId } },
		});
		return { removed: true };
	}

	async addPath(cohortId: string, pathId: string) {
		await this.assertExists(cohortId);
		const path = await this.prisma.learningPath.findUnique({
			where: { id: pathId },
			select: { id: true },
		});
		if (!path) throw new NotFoundException("Path not found");
		const last = await this.prisma.cohortPath.aggregate({
			where: { cohortId },
			_max: { orderIndex: true },
		});
		await this.prisma.cohortPath.create({
			data: { cohortId, pathId, orderIndex: (last._max.orderIndex ?? 0) + 1 },
		});
		return { added: true };
	}

	async removePath(cohortId: string, pathId: string) {
		await this.assertExists(cohortId);
		await this.prisma.cohortPath.delete({
			where: { cohortId_pathId: { cohortId, pathId } },
		});
		return { removed: true };
	}

	async reorderCourses(cohortId: string, courseIds: string[]) {
		await this.assertExists(cohortId);
		await this.prisma.$transaction(
			courseIds.map((courseId, index) =>
				this.prisma.cohortCourse.update({
					where: { cohortId_courseId: { cohortId, courseId } },
					data: { orderIndex: index + 1 },
				}),
			),
		);
		return { reordered: true };
	}

	async assignInstructor(
		admin: AuthenticatedUser,
		cohortId: string,
		userId: string,
	) {
		await this.assertExists(cohortId);
		await this.prisma.cohortInstructor.upsert({
			where: { cohortId_userId: { cohortId, userId } },
			create: { cohortId, userId, assignedBy: admin.id },
			update: {},
		});
		return { assigned: true };
	}

	async removeInstructor(cohortId: string, userId: string) {
		await this.assertExists(cohortId);
		await this.prisma.cohortInstructor.delete({
			where: { cohortId_userId: { cohortId, userId } },
		});
		return { removed: true };
	}

	async assignFacilitator(
		admin: AuthenticatedUser,
		cohortId: string,
		userId: string,
	) {
		await this.assertExists(cohortId);
		await this.prisma.cohortFacilitator.upsert({
			where: { cohortId_userId: { cohortId, userId } },
			create: { cohortId, userId, assignedBy: admin.id },
			update: {},
		});
		return { assigned: true };
	}

	async removeFacilitator(cohortId: string, userId: string) {
		await this.assertExists(cohortId);
		await this.prisma.cohortFacilitator.delete({
			where: { cohortId_userId: { cohortId, userId } },
		});
		return { removed: true };
	}

	/** Open a cohort for enrolment: needs a start date and at least one course. */
	async publishCohort(cohortId: string) {
		const cohort = await this.prisma.cohort.findUnique({
			where: { id: cohortId },
			select: { startsAt: true, _count: { select: { courses: true } } },
		});
		if (!cohort) throw new NotFoundException("Cohort not found");
		const issues: string[] = [];
		if (cohort._count.courses === 0) issues.push("no_courses");
		if (!cohort.startsAt) issues.push("no_start_date");
		if (issues.length > 0) {
			throw new UnprocessableEntityException({
				code: "COHORT_NOT_PUBLISHABLE",
				message: "Set a start date and add at least one course first.",
				details: { issues },
			});
		}
		const updated = await this.prisma.cohort.update({
			where: { id: cohortId },
			data: { status: "open" },
		});
		return this.withPrice(updated);
	}
}
