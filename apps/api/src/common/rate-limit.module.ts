import { Global, Module, type Provider } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerStorage } from "@nestjs/throttler";
import { AiQuotaGuard } from "./guards/ai-quota.guard";
import { GlobalThrottlerGuard } from "./guards/global-throttler.guard";
import { UserThrottlerGuard } from "./guards/user-throttler.guard";
import { isDistributedRuntime } from "./runtime";
import { CacheThrottlerStorage } from "./throttler-storage";

/**
 * Rate limiting (§5.9 Layer 1). Two tiers:
 *  - GLOBAL: 100 req / 60s / IP, applied app-wide via APP_GUARD.
 *  - Per-route stricter limits (AI 20/min/user, payments 10/min/user) via
 *    `@UseGuards(UserThrottlerGuard) + @Throttle` on those controllers.
 *
 * The default throttler is named `global` at 100/60s so the app-wide guard reads
 * it without a decorator.
 *
 * STORAGE: the throttler runs on EVERY request, so its counter is the hottest
 * Redis path there is. On the single free-tier instance the built-in in-memory
 * storage is correct AND costs zero Redis commands — so Redis-backed counters
 * (CacheThrottlerStorage, one INCR+EXPIRE per request) are opt-in via
 * `REDIS_DISTRIBUTED`, needed only once the app runs multiple instances that
 * must share the window. See runtime.ts + the 500k/month cap.
 */
const distributedStorage: Provider[] = isDistributedRuntime()
	? [
			CacheThrottlerStorage,
			{ provide: ThrottlerStorage, useExisting: CacheThrottlerStorage },
		]
	: [];

@Global()
@Module({
	imports: [
		ThrottlerModule.forRoot({
			throttlers: [{ name: "global", ttl: 60_000, limit: 100 }],
		}),
	],
	providers: [
		...distributedStorage,
		{ provide: APP_GUARD, useClass: GlobalThrottlerGuard },
		UserThrottlerGuard,
		AiQuotaGuard,
	],
	exports: [ThrottlerModule, UserThrottlerGuard, AiQuotaGuard],
})
export class RateLimitModule {}
