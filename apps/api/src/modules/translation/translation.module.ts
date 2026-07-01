import { Module } from "@nestjs/common";
import { TranslationController } from "./translation.controller";
import { TranslationService } from "./translation.service";

/** Read-only AI translation with a durable cache (§11). */
@Module({
	controllers: [TranslationController],
	providers: [TranslationService],
})
export class TranslationModule {}
