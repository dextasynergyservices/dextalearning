import { Global, Module } from "@nestjs/common";
import { TenantController } from "./tenant.controller";
import { TenantService } from "./tenant.service";

/**
 * Academy (tenant) context, §2.1/§6.4. Global so any bounded context can resolve
 * an academy slug → tenant id (to scope its own reads) without importing this
 * module — it depends only on the exported `TenantService` interface.
 */
@Global()
@Module({
	controllers: [TenantController],
	providers: [TenantService],
	exports: [TenantService],
})
export class TenantModule {}
