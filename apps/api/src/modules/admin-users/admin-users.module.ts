import { Module } from "@nestjs/common";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

/**
 * Admin user management (§8.7). Owns nothing but the privileged reads/writes on
 * `users`; PrismaModule is global, so it needs no imports.
 */
@Module({
	controllers: [AdminUsersController],
	providers: [AdminUsersService],
})
export class AdminUsersModule {}
