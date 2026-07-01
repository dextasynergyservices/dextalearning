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
import { AssessmentsService } from "./assessments.service";
import {
	CreateAssessmentDto,
	CreateQuestionDto,
	GenerateQuestionsDto,
	ReorderQuestionsDto,
	UpdateAssessmentDto,
	UpdateQuestionDto,
} from "./dto/assessments.dto";

/** Instructor/Admin assessment + question authoring (§4.4). */
@ApiTags("assessments")
@ApiCookieAuth("better-auth.session_token")
@Controller("assessments")
@UseGuards(SessionGuard, RolesGuard)
@Roles("instructor", "admin")
export class AssessmentsController {
	constructor(private readonly assessments: AssessmentsService) {}

	@Post()
	@ApiOperation({
		summary: "Create an assessment",
		description:
			"Scope is one of lesson_pre/lesson_post/module/course_final/path_final/cohort; provide the matching parent id. Cohort scope is admin-only.",
	})
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: CreateAssessmentDto,
	) {
		return this.assessments.createAssessment(user, dto);
	}

	@Get()
	@ApiOperation({
		summary: "List assessments attached to a parent",
		description:
			"Pass exactly one of courseId/moduleId/lessonId/pathId/cohortId.",
	})
	@ApiQuery({ name: "courseId", required: false })
	@ApiQuery({ name: "moduleId", required: false })
	@ApiQuery({ name: "lessonId", required: false })
	@ApiQuery({ name: "pathId", required: false })
	@ApiQuery({ name: "cohortId", required: false })
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Query("courseId") courseId?: string,
		@Query("moduleId") moduleId?: string,
		@Query("lessonId") lessonId?: string,
		@Query("pathId") pathId?: string,
		@Query("cohortId") cohortId?: string,
	) {
		return this.assessments.listForParent(user, {
			courseId,
			moduleId,
			lessonId,
			pathId,
			cohortId,
		});
	}

	@Get(":id")
	@ApiOperation({
		summary: "Get an assessment with its questions (for editing)",
	})
	get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.assessments.getForEdit(user, id);
	}

	@Patch(":id")
	@ApiOperation({
		summary: "Update assessment settings",
		description:
			"Pass mark, time limit, retakes/cooldown, question pool + shuffle, anti-cheat options, schedule and grading type.",
	})
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: UpdateAssessmentDto,
	) {
		return this.assessments.updateAssessment(user, id, dto);
	}

	@Delete(":id")
	@ApiOperation({ summary: "Delete an assessment (cascades its questions)" })
	remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.assessments.deleteAssessment(user, id);
	}

	@Post(":id/questions")
	@ApiOperation({ summary: "Add a question (MCQ / True-False / Short answer)" })
	addQuestion(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: CreateQuestionDto,
	) {
		return this.assessments.addQuestion(user, id, dto);
	}

	@Post(":id/generate")
	@ApiOperation({
		summary: "Generate questions from a lesson transcript with AI (§4.10)",
		description:
			"Reads the source lesson's transcript and appends AI-drafted questions for the instructor to review and edit. Defaults to the assessment's own lesson when lesson-scoped.",
	})
	generate(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: GenerateQuestionsDto,
	) {
		return this.assessments.generateQuestions(user, id, dto);
	}

	@Patch(":id/questions/reorder")
	@ApiOperation({ summary: "Reorder questions within an assessment" })
	reorderQuestions(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: ReorderQuestionsDto,
	) {
		return this.assessments.reorderQuestions(user, id, dto.questionIds);
	}

	@Patch("questions/:questionId")
	@ApiOperation({ summary: "Update a question" })
	updateQuestion(
		@CurrentUser() user: AuthenticatedUser,
		@Param("questionId") questionId: string,
		@Body() dto: UpdateQuestionDto,
	) {
		return this.assessments.updateQuestion(user, questionId, dto);
	}

	@Delete("questions/:questionId")
	@ApiOperation({ summary: "Delete a question" })
	deleteQuestion(
		@CurrentUser() user: AuthenticatedUser,
		@Param("questionId") questionId: string,
	) {
		return this.assessments.deleteQuestion(user, questionId);
	}
}
