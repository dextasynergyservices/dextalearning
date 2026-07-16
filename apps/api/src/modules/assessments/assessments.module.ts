import { Module } from "@nestjs/common";
import { CompletionModule } from "../completion/completion.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AssessmentsController } from "./assessments.controller";
import { AssessmentsService } from "./assessments.service";
import { AttemptsController } from "./attempts.controller";
import { AttemptsService } from "./attempts.service";
import { ReportsController } from "./reports.controller";

/** Assessments bounded context — authoring (§4.4) + learner attempts (§4.6.3). */
@Module({
	imports: [NotificationsModule, CompletionModule],
	controllers: [AssessmentsController, AttemptsController, ReportsController],
	providers: [AssessmentsService, AttemptsService],
})
export class AssessmentsModule {}
