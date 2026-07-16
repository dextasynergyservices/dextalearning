import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	type EntityCompletedEvent,
	LearningEvents,
} from "../../shared/events/learning-events";
import type { EnrollableType } from "../enrollment/enrollment.service";
import { EarnBackService } from "./earn-back.service";

/**
 * Earn-Back's inbound edge (§6.4, §4.11.5). A learner completing ALL criteria
 * for a course/path/cohort triggers resolution of any paid, earn-back-eligible
 * order they hold for it. Certificates subscribe to the SAME event
 * independently — earn-back never issues the certificate, keeping the two
 * contexts decoupled.
 */
@Injectable()
export class EarnBackEventsHandler {
	private readonly logger = new Logger(EarnBackEventsHandler.name);

	constructor(private readonly earnBack: EarnBackService) {}

	@OnEvent(LearningEvents.EntityCompleted)
	async onEntityCompleted(event: EntityCompletedEvent): Promise<void> {
		try {
			await this.earnBack.resolveForCompletion(
				event.userId,
				event.entityType as EnrollableType,
				event.entityId,
				new Date(event.completedAt),
			);
		} catch (error) {
			this.logger.error(`Earn-Back resolution failed: ${String(error)}`);
		}
	}
}
