import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { EnrollmentService } from "./enrollment.service";

/** Learner enrolment in a course / path / cohort (§4.x). */
@ApiTags("enrollment")
@ApiCookieAuth("better-auth.session_token")
@Controller("enrollments")
@UseGuards(SessionGuard)
export class EnrollmentController {
	constructor(private readonly enrollment: EnrollmentService) {}

	@Get(":type/:id")
	@ApiOperation({ summary: "Whether the learner is enrolled in this entity" })
	status(
		@Param("type") type: string,
		@Param("id") id: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.enrollment.getStatus(user, this.enrollment.parseType(type), id);
	}

	@Post(":type/:id")
	@ApiOperation({ summary: "Enrol the learner in this entity" })
	enroll(
		@Param("type") type: string,
		@Param("id") id: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.enrollment.enroll(user, this.enrollment.parseType(type), id);
	}
}
