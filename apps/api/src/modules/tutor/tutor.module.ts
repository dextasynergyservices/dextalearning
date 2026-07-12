import { Module } from "@nestjs/common";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { TutorController } from "./tutor.controller";
import { TutorService } from "./tutor.service";

/**
 * Tutor bounded context (§6.4) — AI lesson Q&A grounded in the transcript.
 * Owns no tables; depends only on the global AI port + a read of the lesson
 * snapshot, so it could be extracted with just its port changing.
 */
@Module({
	imports: [KnowledgeModule],
	controllers: [TutorController],
	providers: [TutorService],
})
export class TutorModule {}
