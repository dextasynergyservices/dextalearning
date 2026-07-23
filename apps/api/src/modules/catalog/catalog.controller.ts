import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { OptionalSessionGuard } from "../../auth/guards/optional-session.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { AcademySlug } from "../../common/academy/academy-slug.decorator";
import { CatalogService } from "./catalog.service";

@ApiTags("catalog")
@Controller("catalog")
export class CatalogController {
	constructor(private readonly catalog: CatalogService) {}

	@Get("featured")
	@ApiOperation({
		summary: "Featured courses, paths and cohorts for the homepage",
	})
	featured(@AcademySlug() academy?: string) {
		return this.catalog.getFeatured(academy);
	}

	@Get("recommended")
	@UseGuards(OptionalSessionGuard)
	@ApiOperation({
		summary: "Recommended content (personalised when signed in, else popular)",
	})
	recommended(
		@CurrentUser() user?: AuthenticatedUser,
		@AcademySlug() academy?: string,
	) {
		return this.catalog.getRecommended(user?.id, academy);
	}

	@Get("feature-requests")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("admin")
	@ApiOperation({ summary: "Pending instructor feature requests (admin)" })
	featureRequests() {
		return this.catalog.getFeatureRequests();
	}

	@Get("courses")
	@ApiOperation({
		summary: "List published courses",
		description:
			"Public browse list of every course in `published` status, newest first. Drafts and archived courses are never returned.",
	})
	@ApiOkResponse({ description: "Array of published course summaries." })
	listCourses(@AcademySlug() academy?: string) {
		return this.catalog.listPublishedCourses(academy);
	}

	@Get("courses/:slug")
	@ApiOperation({
		summary: "Get a published course with its modules and lessons",
		description:
			"Returns the full curriculum (modules → lessons, in order) for a single published course by slug. Returns 404 if the course does not exist or is not published. Lesson media itself is fetched separately via `GET /lessons/:id/media-token`.",
	})
	@ApiOkResponse({ description: "The published course and its curriculum." })
	getCourse(@Param("slug") slug: string, @AcademySlug() academy?: string) {
		return this.catalog.getPublishedCourse(slug, academy);
	}

	@Get("instructors/:id")
	@ApiOperation({
		summary: "Public instructor profile + their published courses",
	})
	@ApiOkResponse({ description: "Instructor profile and authored courses." })
	getInstructor(@Param("id") id: string, @AcademySlug() academy?: string) {
		return this.catalog.getPublishedInstructor(id, academy);
	}

	@Get("paths")
	@ApiOperation({
		summary: "List published Learning Paths",
		description:
			"Public browse list of every path in `published` status, newest first.",
	})
	@ApiOkResponse({ description: "Array of published path summaries." })
	listPaths(@AcademySlug() academy?: string) {
		return this.catalog.listPublishedPaths(academy);
	}

	@Get("paths/:slug")
	@ApiOperation({
		summary: "Get a published Learning Path with its ordered courses",
		description:
			"Returns a published path by slug with its ordered courses. Returns 404 if it does not exist or is not published.",
	})
	@ApiOkResponse({ description: "The published path and its courses." })
	getPath(@Param("slug") slug: string, @AcademySlug() academy?: string) {
		return this.catalog.getPublishedPath(slug, academy);
	}

	@Get("cohorts")
	@ApiOperation({
		summary: "List open cohorts",
		description: "Public list of every cohort in `open` status, by start date.",
	})
	@ApiOkResponse({ description: "Array of open cohort summaries." })
	listCohorts(@AcademySlug() academy?: string) {
		return this.catalog.listPublishedCohorts(academy);
	}

	@Get("cohorts/:slug")
	@ApiOperation({
		summary: "Get an open cohort with its courses",
		description:
			"Returns an open cohort by slug with its ordered courses and assigned instructors. Returns 404 if it does not exist or is not open.",
	})
	@ApiOkResponse({ description: "The open cohort and its courses." })
	getCohort(@Param("slug") slug: string, @AcademySlug() academy?: string) {
		return this.catalog.getPublishedCohort(slug, academy);
	}

	@Get("posts")
	@ApiOperation({
		summary: "List published blog posts",
		description:
			"Public list of every post in `published` status, newest first.",
	})
	@ApiOkResponse({ description: "Array of published post summaries." })
	listPosts() {
		return this.catalog.listPublishedPosts();
	}

	@Get("posts/:slug")
	@ApiOperation({
		summary: "Get a published blog post by slug",
		description: "Returns 404 if the post does not exist or is not published.",
	})
	@ApiOkResponse({ description: "The published post with its body." })
	getPost(@Param("slug") slug: string) {
		return this.catalog.getPublishedPost(slug);
	}
}
