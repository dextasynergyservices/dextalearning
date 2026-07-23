import { Module } from "@nestjs/common";
import { NotificationsModule } from "../modules/notifications/notifications.module";
import { AuthController } from "./auth.controller";

@Module({
	// Registration tells the admins when someone applies to be an instructor.
	imports: [NotificationsModule],
	controllers: [AuthController],
})
export class AuthModule {}
