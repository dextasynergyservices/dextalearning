import { Module } from "@nestjs/common";
import { CompletionModule } from "../completion/completion.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { SubmissionsController } from "./submissions.controller";
import { SubmissionsService } from "./submissions.service";

/** Projects bounded context — authoring + submission + grading (§4.5). */
@Module({
	imports: [NotificationsModule, CompletionModule],
	controllers: [ProjectsController, SubmissionsController],
	providers: [ProjectsService, SubmissionsService],
})
export class ProjectsModule {}
