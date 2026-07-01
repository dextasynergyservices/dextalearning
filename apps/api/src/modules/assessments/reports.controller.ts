import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { AssessmentsService } from "./assessments.service";
import { ReviewReasonDto } from "./dto/reports.dto";

/** Instructor/Admin anti-cheat reporting + review actions (§4.6.4). */
@ApiTags("assessment-reports")
@ApiCookieAuth("better-auth.session_token")
@Controller("assessment-reports")
@UseGuards(SessionGuard, RolesGuard)
@Roles("instructor", "admin")
export class ReportsController {
	constructor(private readonly assessments: AssessmentsService) {}

	@Get("all")
	@ApiOperation({
		summary: "Admin: all flagged integrity reports across the platform",
	})
	listAll(@CurrentUser() user: AuthenticatedUser) {
		return this.assessments.listAllIntegrityReports(user);
	}

	@Get("assessment/:id")
	@ApiOperation({
		summary: "Attempts for an assessment (most suspicious first)",
	})
	list(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.assessments.listAttempts(user, id);
	}

	@Get("attempt/:attemptId")
	@ApiOperation({
		summary: "Integrity report for one attempt (flags + screenshots)",
	})
	report(
		@CurrentUser() user: AuthenticatedUser,
		@Param("attemptId") attemptId: string,
	) {
		return this.assessments.getAttemptReport(user, attemptId);
	}

	@Post("attempt/:attemptId/invalidate")
	@ApiOperation({ summary: "Invalidate the attempt — the learner must retake" })
	invalidate(
		@CurrentUser() user: AuthenticatedUser,
		@Param("attemptId") attemptId: string,
		@Body() dto: ReviewReasonDto,
	) {
		return this.assessments.invalidateAttempt(user, attemptId, dto.reason);
	}

	@Post("attempt/:attemptId/accept")
	@ApiOperation({ summary: "Accept the attempt as-is" })
	accept(
		@CurrentUser() user: AuthenticatedUser,
		@Param("attemptId") attemptId: string,
	) {
		return this.assessments.acceptAttempt(user, attemptId);
	}

	@Post("attempt/:attemptId/escalate")
	@ApiOperation({ summary: "Escalate the attempt to an admin" })
	escalate(
		@CurrentUser() user: AuthenticatedUser,
		@Param("attemptId") attemptId: string,
		@Body() dto: ReviewReasonDto,
	) {
		return this.assessments.escalateAttempt(user, attemptId, dto.reason);
	}
}
