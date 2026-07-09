import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import {
	type EnrollmentCreatedEvent,
	LearningEvents,
} from "../../shared/events/learning-events";

/**
 * Catalog's inbound edge (§6.4): maintains the denormalized social-proof
 * counter (`courses.enrolled_count`, §3.2 "47 teachers completed this
 * module") from Enrollment's events — never by reading enrolment tables.
 * Only genuine creations emit, so a plain increment stays accurate.
 * (Paths/cohorts have no counter column yet — Phase 5.)
 */
@Injectable()
export class CatalogEventsHandler {
	private readonly logger = new Logger(CatalogEventsHandler.name);

	constructor(private readonly prisma: PrismaService) {}

	@OnEvent(LearningEvents.EnrollmentCreated)
	async onEnrollmentCreated(event: EnrollmentCreatedEvent): Promise<void> {
		if (event.entityType !== "course") return;
		try {
			await this.prisma.course.update({
				where: { id: event.entityId },
				data: { enrolledCount: { increment: 1 } },
			});
		} catch (error) {
			this.logger.error(`enrolledCount increment failed: ${String(error)}`);
		}
	}
}
