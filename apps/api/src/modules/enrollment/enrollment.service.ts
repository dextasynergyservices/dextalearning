import {
	BadRequestException,
	HttpException,
	HttpStatus,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import {
	type EnrollmentCreatedEvent,
	LearningEvents,
} from "../../shared/events/learning-events";

export type EnrollableType = "course" | "path" | "cohort";

const TYPES: EnrollableType[] = ["course", "path", "cohort"];

/**
 * Enrolment (§4.x). A learner must enrol before they can start a course, path or
 * cohort — even free ones. Enrolment is currently free (payment gating arrives
 * with the payments phase); it just records that the learner joined. "Started"
 * vs "enrolled" is a separate concept driven by completion progress.
 */
@Injectable()
export class EnrollmentService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly events: EventEmitter2,
	) {}

	parseType(raw: string): EnrollableType {
		if (!TYPES.includes(raw as EnrollableType)) {
			throw new BadRequestException("Unknown enrolment type");
		}
		return raw as EnrollableType;
	}

	async getStatus(user: AuthenticatedUser, type: EnrollableType, id: string) {
		return { enrolled: await this.isEnrolled(user.id, type, id) };
	}

	async isEnrolled(
		userId: string,
		type: EnrollableType,
		id: string,
	): Promise<boolean> {
		if (type === "course") {
			return Boolean(
				await this.prisma.courseEnrollment.findUnique({
					where: { courseId_userId: { courseId: id, userId } },
					select: { userId: true },
				}),
			);
		}
		if (type === "path") {
			return Boolean(
				await this.prisma.pathEnrollment.findUnique({
					where: { pathId_userId: { pathId: id, userId } },
					select: { userId: true },
				}),
			);
		}
		return Boolean(
			await this.prisma.cohortEnrollment.findUnique({
				where: { cohortId_userId: { cohortId: id, userId } },
				select: { userId: true },
			}),
		);
	}

	async enroll(user: AuthenticatedUser, type: EnrollableType, id: string) {
		await this.assertOpen(type, id);
		// Paid content is gated behind a settled payment (§14): the learner can't
		// self-enrol — the payment webhook calls `enrollAfterPayment`. Free content
		// enrols directly. A 402 tells the client to route through checkout.
		if (await this.isPaid(type, id)) {
			throw new HttpException(
				"This content requires payment — start checkout to enrol",
				HttpStatus.PAYMENT_REQUIRED,
			);
		}
		return this.createEnrollment(user.id, type, id);
	}

	/**
	 * Enrol after a confirmed payment (§14.2). Bypasses the paid-content gate —
	 * the caller (Payments) has already settled the order — and is idempotent so a
	 * webhook retry never errors. NOT exposed over HTTP.
	 */
	async enrollAfterPayment(userId: string, type: EnrollableType, id: string) {
		return this.createEnrollment(userId, type, id);
	}

	private async createEnrollment(
		userId: string,
		type: EnrollableType,
		id: string,
	) {
		// Create (not upsert) so a NEW enrolment is distinguishable from a
		// re-enrol no-op — only genuine creations emit EnrollmentCreated (§6.4);
		// Catalog subscribes to maintain social-proof counters. A concurrent
		// duplicate loses the unique race (P2002) and is treated as already
		// enrolled.
		let created = false;
		try {
			if (type === "course") {
				await this.prisma.courseEnrollment.create({
					data: { courseId: id, userId, status: "active" },
				});
			} else if (type === "path") {
				await this.prisma.pathEnrollment.create({
					data: { pathId: id, userId, status: "active" },
				});
			} else {
				await this.prisma.cohortEnrollment.create({
					data: { cohortId: id, userId, status: "active" },
				});
			}
			created = true;
		} catch (error) {
			if (
				!(error instanceof Object) ||
				(error as { code?: string }).code !== "P2002"
			) {
				throw error;
			}
		}
		if (created) {
			this.events.emit(LearningEvents.EnrollmentCreated, {
				userId,
				entityType: type,
				entityId: id,
			} satisfies EnrollmentCreatedEvent);
		}
		return { enrolled: true as const };
	}

	/** Whether an entity is paid (not free) — the checkout gate for `enroll`. */
	private async isPaid(type: EnrollableType, id: string): Promise<boolean> {
		if (type === "course") {
			const c = await this.prisma.course.findUnique({
				where: { id },
				select: { isFree: true, price: true },
			});
			return !!c && !c.isFree && Number(c.price) > 0;
		}
		if (type === "path") {
			const p = await this.prisma.learningPath.findUnique({
				where: { id },
				select: { isFree: true, price: true },
			});
			return !!p && !p.isFree && Number(p.price) > 0;
		}
		const co = await this.prisma.cohort.findUnique({
			where: { id },
			select: { isFree: true, price: true },
		});
		return !!co && !co.isFree && Number(co.price) > 0;
	}

	/** Only published courses/paths and open cohorts can be enrolled in. */
	private async assertOpen(type: EnrollableType, id: string) {
		if (type === "course") {
			const c = await this.prisma.course.findUnique({
				where: { id },
				select: { status: true },
			});
			if (c?.status !== "published") {
				throw new NotFoundException("Course not available");
			}
		} else if (type === "path") {
			const p = await this.prisma.learningPath.findUnique({
				where: { id },
				select: { status: true },
			});
			if (p?.status !== "published") {
				throw new NotFoundException("Path not available");
			}
		} else {
			const co = await this.prisma.cohort.findUnique({
				where: { id },
				select: { status: true },
			});
			if (co?.status !== "open") {
				throw new NotFoundException("Cohort not available");
			}
		}
	}
}
