import { Module } from "@nestjs/common";
import { EnrollmentController } from "./enrollment.controller";
import { EnrollmentService } from "./enrollment.service";

/** Enrolment bounded context — joining a course / path / cohort (§4.x). */
@Module({
	controllers: [EnrollmentController],
	providers: [EnrollmentService],
	exports: [EnrollmentService],
})
export class EnrollmentModule {}
