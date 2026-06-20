import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UnprocessableEntityException,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import type { UploadFile } from "../media/media.constants";
import { AuthoringService } from "./authoring.service";
import {
	CreateCourseDto,
	CreateLessonDto,
	CreateModuleDto,
	ReorderLessonsDto,
	UpdateCourseDto,
	UpdateLessonDto,
} from "./dto/authoring.dto";

/** Instructor/Admin content authoring: courses → modules → lessons (§4.3). */
@ApiTags("authoring")
@ApiCookieAuth("better-auth.session_token")
@Controller()
@UseGuards(SessionGuard, RolesGuard)
@Roles("instructor", "admin")
export class AuthoringController {
	constructor(private readonly authoring: AuthoringService) {}

	@Post("courses")
	@ApiOperation({
		summary: "Create a course",
		description:
			"Creates a new draft course owned by the caller (slug auto-generated). Instructors own their courses; admins can manage any.",
	})
	createCourse(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: CreateCourseDto,
	) {
		return this.authoring.createCourse(user, dto);
	}

	@Get("courses/mine")
	@ApiOperation({
		summary: "List the caller's own courses (all admins' if admin)",
	})
	listMine(@CurrentUser() user: AuthenticatedUser) {
		return this.authoring.listMine(user);
	}

	@Get("courses/:id")
	@ApiOperation({
		summary: "Get a course for editing",
		description:
			"Full curriculum (modules → lessons in order) for the owner/admin.",
	})
	getCourse(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.authoring.getCourseForEdit(user, id);
	}

	@Patch("courses/:id")
	@ApiOperation({
		summary: "Update course settings",
		description:
			"Title, description, level, language, pricing (free/price/currency) and Earn-Back (on/off, 1–100% of price, deadline days). Free courses force Earn-Back off; enabling Earn-Back defaults to 100% (§4.11).",
	})
	updateCourse(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: UpdateCourseDto,
	) {
		return this.authoring.updateCourse(user, id, dto);
	}

	@Post("courses/:id/thumbnail")
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
	)
	@ApiOperation({
		summary: "Upload (replace) the course thumbnail",
		description:
			"Accepts a PNG/JPG/WebP image (≤5 MB) shown on catalogue cards and the course page. Returns the stored key and a presigned URL.",
	})
	uploadThumbnail(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@UploadedFile() file: UploadFile,
	) {
		if (!file) {
			throw new UnprocessableEntityException({
				code: "MEDIA_FILE_REQUIRED",
				message: "No image was uploaded.",
			});
		}
		return this.authoring.uploadCourseThumbnail(user, id, file);
	}

	@Delete("courses/:id")
	@ApiOperation({ summary: "Delete a course (cascades modules & lessons)" })
	deleteCourse(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
	) {
		return this.authoring.deleteCourse(user, id);
	}

	@Post("courses/:id/publish")
	@ApiOperation({
		summary: "Publish a course",
		description:
			"Validates every lesson has content + a transcript (and video/audio is encoded). Returns 422 `COURSE_NOT_PUBLISHABLE` with the offending lessons if not ready.",
	})
	publishCourse(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
	) {
		return this.authoring.publishCourse(user, id);
	}

	@Post("courses/:courseId/modules")
	@ApiOperation({ summary: "Add a module to a course (appended in order)" })
	createModule(
		@CurrentUser() user: AuthenticatedUser,
		@Param("courseId") courseId: string,
		@Body() dto: CreateModuleDto,
	) {
		return this.authoring.createModule(user, courseId, dto);
	}

	@Patch("modules/:id")
	@ApiOperation({ summary: "Rename a module" })
	renameModule(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: CreateModuleDto,
	) {
		return this.authoring.renameModule(user, id, dto.title);
	}

	@Delete("modules/:id")
	@ApiOperation({ summary: "Delete a module (cascades its lessons)" })
	deleteModule(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
	) {
		return this.authoring.deleteModule(user, id);
	}

	@Post("modules/:moduleId/lessons")
	@ApiOperation({ summary: "Add a lesson to a module (appended in order)" })
	createLesson(
		@CurrentUser() user: AuthenticatedUser,
		@Param("moduleId") moduleId: string,
		@Body() dto: CreateLessonDto,
	) {
		return this.authoring.createLesson(user, moduleId, dto);
	}

	@Patch("modules/:moduleId/lessons/reorder")
	@ApiOperation({
		summary: "Reorder lessons within a module",
		description:
			"Send the lesson IDs in the desired order; `orderIndex` is rewritten transactionally.",
	})
	reorderLessons(
		@CurrentUser() user: AuthenticatedUser,
		@Param("moduleId") moduleId: string,
		@Body() dto: ReorderLessonsDto,
	) {
		return this.authoring.reorderLessons(user, moduleId, dto.lessonIds);
	}

	@Get("lessons/:id/edit")
	@ApiOperation({
		summary: "Get a lesson for editing",
		description:
			"Includes the lesson's uploaded captions so the editor can show per-language status.",
	})
	getLesson(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.authoring.getLessonForEdit(user, id);
	}

	@Patch("lessons/:id")
	@ApiOperation({
		summary: "Update a lesson",
		description:
			"Title, content type, rich-text body (text lessons), and completion config (watch %, quizzes).",
	})
	updateLesson(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: UpdateLessonDto,
	) {
		return this.authoring.updateLesson(user, id, dto);
	}

	@Delete("lessons/:id")
	@ApiOperation({ summary: "Delete a lesson" })
	deleteLesson(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
	) {
		return this.authoring.deleteLesson(user, id);
	}
}
