import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import {
	ApiCookieAuth,
	ApiOperation,
	ApiQuery,
	ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { CreateProjectDto, UpdateProjectDto } from "./dto/projects.dto";
import { GradeSubmissionDto } from "./dto/submissions.dto";
import { ProjectsService } from "./projects.service";

/** Instructor/Admin project authoring (§4.5). */
@ApiTags("projects")
@ApiCookieAuth("better-auth.session_token")
@Controller("projects")
@UseGuards(SessionGuard, RolesGuard)
@Roles("instructor", "admin")
export class ProjectsController {
	constructor(private readonly projects: ProjectsService) {}

	@Post()
	@ApiOperation({
		summary: "Create a project",
		description:
			"Scope is course/path/cohort; provide the matching parent id. Cohort scope is admin-only.",
	})
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: CreateProjectDto,
	) {
		return this.projects.createProject(user, dto);
	}

	@Get()
	@ApiOperation({ summary: "List projects attached to a parent" })
	@ApiQuery({ name: "courseId", required: false })
	@ApiQuery({ name: "pathId", required: false })
	@ApiQuery({ name: "cohortId", required: false })
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Query("courseId") courseId?: string,
		@Query("pathId") pathId?: string,
		@Query("cohortId") cohortId?: string,
	) {
		return this.projects.listForParent(user, { courseId, pathId, cohortId });
	}

	@Get(":id")
	@ApiOperation({ summary: "Get a project (for editing)" })
	get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.projects.getForEdit(user, id);
	}

	@Patch(":id")
	@ApiOperation({
		summary: "Update project settings",
		description:
			"Description, submission types, grading type, pass mark, due date, file limits and rubric.",
	})
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: UpdateProjectDto,
	) {
		return this.projects.updateProject(user, id, dto);
	}

	@Delete(":id")
	@ApiOperation({ summary: "Delete a project (cascades its submissions)" })
	remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.projects.deleteProject(user, id);
	}

	// ── Grading (§4.5) ────────────────────────────────────────────────────────
	@Get(":id/submissions")
	@ApiOperation({ summary: "List submissions for a project (grading queue)" })
	submissions(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.projects.listSubmissions(user, id);
	}

	@Get("submissions/:submissionId")
	@ApiOperation({
		summary: "Get a submission to grade (files presigned + rubric)",
	})
	submission(
		@CurrentUser() user: AuthenticatedUser,
		@Param("submissionId") submissionId: string,
	) {
		return this.projects.getSubmissionForGrading(user, submissionId);
	}

	@Post("submissions/:submissionId/ai-draft")
	@ApiOperation({
		summary: "AI-assisted draft grade (§4.5 — instructor confirms)",
		description:
			"Returns suggested rubric scores + feedback; nothing is saved.",
	})
	aiDraft(
		@CurrentUser() user: AuthenticatedUser,
		@Param("submissionId") submissionId: string,
	) {
		return this.projects.aiDraftGrade(user, submissionId);
	}

	@Post("submissions/:submissionId/grade")
	@ApiOperation({ summary: "Grade a submission (rubric or explicit score)" })
	grade(
		@CurrentUser() user: AuthenticatedUser,
		@Param("submissionId") submissionId: string,
		@Body() dto: GradeSubmissionDto,
	) {
		return this.projects.gradeSubmission(user, submissionId, dto);
	}
}
