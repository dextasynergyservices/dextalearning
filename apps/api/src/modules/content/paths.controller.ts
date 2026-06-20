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
import {
	AddPathCourseDto,
	CreatePathDto,
	ReorderPathCoursesDto,
	UpdatePathDto,
} from "./dto/paths.dto";
import { PathsService } from "./paths.service";

/** Instructor/Admin Learning Path authoring: ordered courses + commercials (§4.1). */
@ApiTags("paths")
@ApiCookieAuth("better-auth.session_token")
@Controller("paths")
@UseGuards(SessionGuard, RolesGuard)
@Roles("instructor", "admin")
export class PathsController {
	constructor(private readonly paths: PathsService) {}

	@Post()
	@ApiOperation({
		summary: "Create a Learning Path",
		description:
			"Creates a new draft path owned by the caller (slug auto-generated).",
	})
	create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePathDto) {
		return this.paths.createPath(user, dto);
	}

	@Get("mine")
	@ApiOperation({ summary: "List the caller's own paths (all if admin)" })
	listMine(@CurrentUser() user: AuthenticatedUser) {
		return this.paths.listMine(user);
	}

	@Get(":id")
	@ApiOperation({
		summary: "Get a path for editing",
		description:
			"Includes its ordered courses and the courses still available to add.",
	})
	get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.paths.getPathForEdit(user, id);
	}

	@Patch(":id")
	@ApiOperation({
		summary: "Update path settings",
		description:
			"Title, description, level, outcome, estimated hours, pricing and Earn-Back. The Earn-Back % governs the whole path purchase (§4.11).",
	})
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: UpdatePathDto,
	) {
		return this.paths.updatePath(user, id, dto);
	}

	@Delete(":id")
	@ApiOperation({ summary: "Delete a path (its course links are removed)" })
	remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.paths.deletePath(user, id);
	}

	@Post(":id/thumbnail")
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
	)
	@ApiOperation({
		summary: "Upload (replace) the path thumbnail (PNG/JPG/WebP ≤5MB)",
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
		return this.paths.uploadThumbnail(user, id, file);
	}

	@Post(":id/publish")
	@ApiOperation({
		summary: "Publish a path",
		description:
			"Requires at least one course; returns 422 `PATH_NOT_PUBLISHABLE` otherwise.",
	})
	publish(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.paths.publishPath(user, id);
	}

	@Post(":id/courses")
	@ApiOperation({ summary: "Append a course to the path" })
	addCourse(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: AddPathCourseDto,
	) {
		return this.paths.addCourse(user, id, dto.courseId, dto.isRequired ?? true);
	}

	@Patch(":id/courses/reorder")
	@ApiOperation({
		summary: "Reorder the path's courses",
		description: "Send the course IDs in the desired order.",
	})
	reorderCourses(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: ReorderPathCoursesDto,
	) {
		return this.paths.reorderCourses(user, id, dto.courseIds);
	}

	@Delete(":id/courses/:courseId")
	@ApiOperation({ summary: "Remove a course from the path" })
	removeCourse(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Param("courseId") courseId: string,
	) {
		return this.paths.removeCourse(user, id, courseId);
	}
}
