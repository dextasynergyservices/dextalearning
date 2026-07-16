import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	type EntityCompletedEvent,
	LearningEvents,
} from "../../shared/events/learning-events";
import type { EnrollableType } from "../enrollment/enrollment.service";
import { CertificatesService } from "./certificates.service";

/**
 * Certificates' inbound edge (§6.4, §5.8). Completing a course/path/cohort
 * issues the certificate — regardless of any Earn-Back outcome (§4.11.5
 * "Certificate issued regardless of payout"), which is why both contexts
 * subscribe to the same event rather than calling each other.
 */
@Injectable()
export class CertificatesEventsHandler {
	private readonly logger = new Logger(CertificatesEventsHandler.name);

	constructor(private readonly certificates: CertificatesService) {}

	@OnEvent(LearningEvents.EntityCompleted)
	async onEntityCompleted(event: EntityCompletedEvent): Promise<void> {
		try {
			await this.certificates.issue(
				event.userId,
				event.entityType as EnrollableType,
				event.entityId,
			);
		} catch (error) {
			this.logger.error(`Certificate issuance failed: ${String(error)}`);
		}
	}
}
