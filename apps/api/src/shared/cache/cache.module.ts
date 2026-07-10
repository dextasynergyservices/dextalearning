import { Global, Module } from "@nestjs/common";
import { CACHE_PORT } from "./cache.port";
import { RedisCacheAdapter } from "./redis-cache.adapter";

/**
 * Binds `CachePort` to the Redis/in-memory adapter. Global so any context can
 * cache without importing the backend (§6.4) — mirrors StorageModule /
 * NotificationsPortModule.
 */
@Global()
@Module({
	providers: [{ provide: CACHE_PORT, useClass: RedisCacheAdapter }],
	exports: [CACHE_PORT],
})
export class CacheModule {}
