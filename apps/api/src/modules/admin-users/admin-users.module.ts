import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

/**
 * Admin user management (§8.7). Owns nothing but the privileged reads/writes on
 * `users`; PrismaModule is global. Notifications tell an applicant the outcome
 * of their instructor application (§5).
 */
@Module({
	imports: [NotificationsModule],
	controllers: [AdminUsersController],
	providers: [AdminUsersService],
})
export class AdminUsersModule {}
