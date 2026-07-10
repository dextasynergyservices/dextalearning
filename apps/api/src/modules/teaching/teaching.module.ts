import { Module } from "@nestjs/common";
import { TeachingController } from "./teaching.controller";
import { TeachingService } from "./teaching.service";

/**
 * Teaching bounded context (§6.4) — an instructor's read-only view of the
 * cohorts they teach. Reads cohort/enrolment/completion data; owns no tables
 * and writes nothing.
 */
@Module({
	controllers: [TeachingController],
	providers: [TeachingService],
})
export class TeachingModule {}
