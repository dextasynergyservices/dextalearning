import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { CompletionService } from "./completion.service";
import { LessonProgressDto } from "./dto/lesson-progress.dto";

/** Learner-facing course progress + completion (§4.3). */
@ApiTags("completion")
@ApiCookieAuth("better-auth.session_token")
@Controller("completion")
@UseGuards(SessionGuard)
export class CompletionController {
	constructor(private readonly completion: CompletionService) {}

	@Get("mine")
	@ApiOperation({
		summary: "My Learning — the learner's started courses, paths and cohorts",
	})
	mine(@CurrentUser() user: AuthenticatedUser) {
		return this.completion.getMine(user);
	}

	@Get("courses/:courseId")
	@ApiOperation({
		summary: "Course progress + completion breakdown for the current learner",
	})
	course(
		@CurrentUser() user: AuthenticatedUser,
		@Param("courseId") courseId: string,
	) {
		return this.completion.getCourseProgress(user, courseId);
	}

	@Post("lessons/:lessonId/progress")
	@ApiOperation({
		summary:
			"Report lesson consumption; the system auto-completes it per §4.3 (no manual marking)",
	})
	lessonProgress(
		@CurrentUser() user: AuthenticatedUser,
		@Param("lessonId") lessonId: string,
		@Body() dto: LessonProgressDto,
	) {
		return this.completion.recordLessonProgress(user, lessonId, dto);
	}

	@Get("lessons/:lessonId/context")
	@ApiOperation({
		summary: "Lesson player context (course + prev/next + done)",
	})
	lessonContext(
		@CurrentUser() user: AuthenticatedUser,
		@Param("lessonId") lessonId: string,
	) {
		return this.completion.getLessonContext(user, lessonId);
	}

	@Get("paths/:pathId")
	@ApiOperation({ summary: "Path progress (all required courses complete)" })
	path(
		@CurrentUser() user: AuthenticatedUser,
		@Param("pathId") pathId: string,
	) {
		return this.completion.getPathProgress(user, pathId);
	}

	@Get("cohorts/:cohortId")
	@ApiOperation({
		summary: "Cohort progress (courses + cohort assessments/projects)",
	})
	cohort(
		@CurrentUser() user: AuthenticatedUser,
		@Param("cohortId") cohortId: string,
	) {
		return this.completion.getCohortProgress(user, cohortId);
	}
}
