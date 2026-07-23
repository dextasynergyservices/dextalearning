import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthoringController } from "./authoring.controller";
import { AuthoringService } from "./authoring.service";
import { BlogController } from "./blog.controller";
import { BlogService } from "./blog.service";
import { CohortsController } from "./cohorts.controller";
import { CohortsService } from "./cohorts.service";
import { PathsController } from "./paths.controller";
import { PathsService } from "./paths.service";

/** Content authoring bounded context — courses, paths, cohorts and blog (§4.1, §4.3). */
@Module({
	// §8.6 notices: facilitator assignment, and admins on a course going live.
	imports: [NotificationsModule],
	controllers: [
		AuthoringController,
		PathsController,
		CohortsController,
		BlogController,
	],
	providers: [AuthoringService, PathsService, CohortsService, BlogService],
})
export class ContentModule {}
