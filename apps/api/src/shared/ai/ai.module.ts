import { Global, Module } from "@nestjs/common";
import { AI_PORT } from "./ai.port";
import { ClaudeAdapter } from "./claude.adapter";
import { FallbackAdapter } from "./fallback.adapter";
import { GeminiAdapter } from "./gemini.adapter";

/**
 * Binds the `AiPort` to the resilient Gemini→Claude composite (§5): Gemini is
 * primary, Claude Sonnet the fallback. Global so any bounded context can depend
 * on the port without importing AI internals (§6.4).
 */
@Global()
@Module({
	providers: [
		GeminiAdapter,
		ClaudeAdapter,
		{ provide: AI_PORT, useClass: FallbackAdapter },
	],
	exports: [AI_PORT],
})
export class AiModule {}
