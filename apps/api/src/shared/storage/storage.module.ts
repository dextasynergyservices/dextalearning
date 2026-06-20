import { Global, Module } from "@nestjs/common";
import { R2StorageAdapter } from "./r2-storage.adapter";
import { STORAGE_PORT } from "./storage.port";

/**
 * Binds the `StoragePort` to the Cloudflare R2 adapter. Global so any bounded
 * context can depend on the port without importing storage internals (§6.4).
 */
@Global()
@Module({
	providers: [{ provide: STORAGE_PORT, useClass: R2StorageAdapter }],
	exports: [STORAGE_PORT],
})
export class StorageModule {}
