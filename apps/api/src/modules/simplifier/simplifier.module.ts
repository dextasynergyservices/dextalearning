import { Module } from "@nestjs/common";
import { SimplifierController } from "./simplifier.controller";
import { SimplifierService } from "./simplifier.service";

/**
 * Simplifier bounded context (§6.4) — AI plain-language rewrite of lesson text.
 * Owns no tables; depends only on the global AI port + a read of the lesson
 * snapshot, so it could be extracted with just its port changing.
 */
@Module({
	controllers: [SimplifierController],
	providers: [SimplifierService],
})
export class SimplifierModule {}
