import { Module } from "@nestjs/common";
import { CompletionController } from "./completion.controller";
import { CompletionService } from "./completion.service";

/** Completion bounded context — course progress + completion gates (§4.3). */
@Module({
	controllers: [CompletionController],
	providers: [CompletionService],
})
export class CompletionModule {}
