import { Module } from "@nestjs/common";
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
	controllers: [
		AuthoringController,
		PathsController,
		CohortsController,
		BlogController,
	],
	providers: [AuthoringService, PathsService, CohortsService, BlogService],
})
export class ContentModule {}
