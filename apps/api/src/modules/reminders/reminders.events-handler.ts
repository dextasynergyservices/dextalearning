import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import {
	LearningEvents,
	type LessonCompletedEvent,
} from "../../shared/events/learning-events";
import { localDateOf } from "../engagement/streak.calculator";
import { firstDueOn } from "./reminder.calculator";

/**
 * Reminders' inbound edge (§6.4 rule 5): each completed lesson becomes a
 * snapshot `ReviewItem` — titles copied from the event payload so this
 * context NEVER joins back into Content/Completion tables. Idempotent via
 * the (userId, lessonId) unique key; a re-completion (e.g. after an attempt
 * invalidation) never resets an in-flight review ladder.
 */
@Injectable()
export class RemindersEventsHandler {
	private readonly logger = new Logger(RemindersEventsHandler.name);

	constructor(private readonly prisma: PrismaService) {}

	@OnEvent(LearningEvents.LessonCompleted)
	async onLessonCompleted(event: LessonCompletedEvent): Promise<void> {
		try {
			const user = await this.prisma.user.findUnique({
				where: { id: event.userId },
				select: { timezone: true },
			});
			const completedOn = localDateOf(
				new Date(event.completedAt),
				user?.timezone,
			);
			await this.prisma.reviewItem.create({
				data: {
					userId: event.userId,
					lessonId: event.lessonId,
					courseId: event.courseId,
					lessonTitle: event.lessonTitle,
					courseTitle: event.courseTitle,
					completedOn: new Date(completedOn),
					intervalIndex: 0,
					nextDueOn: new Date(firstDueOn(completedOn)),
				},
			});
		} catch (error) {
			if ((error as { code?: string }).code === "P2002") return; // ladder exists
			this.logger.error(`ReviewItem seed failed: ${String(error)}`);
		}
	}
}
