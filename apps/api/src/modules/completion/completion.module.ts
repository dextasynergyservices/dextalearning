import { Module } from "@nestjs/common";
import { CompletionController } from "./completion.controller";
import { CompletionService } from "./completion.service";

/**
 * Completion bounded context — course progress + completion gates (§4.3).
 * Exports its service so Assessments/Projects can ask "may this learner open
 * the final yet?" instead of re-deriving progress themselves (§6.4).
 */
@Module({
	controllers: [CompletionController],
	providers: [CompletionService],
	exports: [CompletionService],
})
export class CompletionModule {}
