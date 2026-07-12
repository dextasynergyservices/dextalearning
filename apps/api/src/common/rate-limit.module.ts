import { Global, Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AiQuotaGuard } from "./guards/ai-quota.guard";
import { UserThrottlerGuard } from "./guards/user-throttler.guard";

/**
 * Global rate-limit + AI-quota providers (§5). Wraps `ThrottlerModule` so its
 * storage/options resolve anywhere, and exposes the two guards used only on the
 * expensive AI routes (applied per-route via `@UseGuards`, never app-wide).
 * A loose 60/min default backs any route the throttle guard is attached to.
 */
@Global()
@Module({
	imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
	providers: [UserThrottlerGuard, AiQuotaGuard],
	exports: [ThrottlerModule, UserThrottlerGuard, AiQuotaGuard],
})
export class RateLimitModule {}
