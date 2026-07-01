import { Global, Module } from "@nestjs/common";
import { AI_PORT } from "./ai.port";
import { GeminiAdapter } from "./gemini.adapter";

/**
 * Binds the `AiPort` to the Google Gemini adapter (§5). Global so any bounded
 * context can depend on the port without importing AI internals (§6.4).
 */
@Global()
@Module({
	providers: [{ provide: AI_PORT, useClass: GeminiAdapter }],
	exports: [AI_PORT],
})
export class AiModule {}
