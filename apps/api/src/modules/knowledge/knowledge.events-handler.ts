import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
	ContentEvents,
	type TranscriptUpdatedEvent,
} from "../../shared/events/content-events";
import { KnowledgeService } from "./knowledge.service";

/**
 * Re-indexes a lesson whenever its transcript changes (§6.4 — reacts to the
 * media context's event, never calls it). The event carries the transcript +
 * title + course snapshot, so this never reads back into content tables.
 */
@Injectable()
export class KnowledgeEventsHandler {
	private readonly logger = new Logger(KnowledgeEventsHandler.name);

	constructor(private readonly knowledge: KnowledgeService) {}

	@OnEvent(ContentEvents.TranscriptUpdated)
	async onTranscriptUpdated(event: TranscriptUpdatedEvent): Promise<void> {
		try {
			await this.knowledge.indexLesson({
				lessonId: event.lessonId,
				lessonTitle: event.lessonTitle,
				courseId: event.courseId,
				transcriptText: event.transcriptText,
			});
		} catch (error) {
			// Indexing is best-effort — never block the transcript save on the AI.
			this.logger.error(
				`Failed to index lesson ${event.lessonId}: ${(error as Error).message}`,
			);
		}
	}
}
