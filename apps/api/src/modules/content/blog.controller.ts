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
import { BlogService } from "./blog.service";
import { CreateBlogPostDto, UpdateBlogPostDto } from "./dto/blog.dto";

/** Admin-only blog authoring: posts + cover images. */
@ApiTags("blog")
@ApiCookieAuth("better-auth.session_token")
@Controller("blog")
@UseGuards(SessionGuard, RolesGuard)
@Roles("admin")
export class BlogController {
	constructor(private readonly blog: BlogService) {}

	@Post()
	@ApiOperation({ summary: "Create a blog post (draft)" })
	create(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: CreateBlogPostDto,
	) {
		return this.blog.createPost(user, dto);
	}

	@Get()
	@ApiOperation({ summary: "List all blog posts" })
	list() {
		return this.blog.listAll();
	}

	@Get(":id")
	@ApiOperation({ summary: "Get a post for editing" })
	get(@Param("id") id: string) {
		return this.blog.getForEdit(id);
	}

	@Patch(":id")
	@ApiOperation({
		summary: "Update a post (title, excerpt, category, author, body)",
		description: "Read time is recomputed from the body automatically.",
	})
	update(@Param("id") id: string, @Body() dto: UpdateBlogPostDto) {
		return this.blog.updatePost(id, dto);
	}

	@Delete(":id")
	@ApiOperation({ summary: "Delete a post" })
	remove(@Param("id") id: string) {
		return this.blog.deletePost(id);
	}

	@Post(":id/cover")
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
	)
	@ApiOperation({
		summary: "Upload (replace) the cover image (PNG/JPG/WebP ≤5MB)",
	})
	uploadCover(@Param("id") id: string, @UploadedFile() file: UploadFile) {
		if (!file) {
			throw new UnprocessableEntityException({
				code: "MEDIA_FILE_REQUIRED",
				message: "No image was uploaded.",
			});
		}
		return this.blog.uploadCover(id, file);
	}

	@Post(":id/publish")
	@ApiOperation({
		summary: "Publish a post",
		description:
			"Requires a body; returns 422 `POST_NOT_PUBLISHABLE` otherwise.",
	})
	publish(@Param("id") id: string) {
		return this.blog.publishPost(id);
	}
}
