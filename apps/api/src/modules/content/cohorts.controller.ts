import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { CohortsService } from "./cohorts.service";
import {
	AddCohortCourseDto,
	AssignUserDto,
	CreateCohortDto,
	ReorderCohortCoursesDto,
	UpdateCohortDto,
} from "./dto/cohorts.dto";

/** Admin-only Cohort authoring (§4.1): schedule, courses, grouping, staff. */
@ApiTags("cohorts")
@ApiCookieAuth("better-auth.session_token")
@Controller("cohorts")
@UseGuards(SessionGuard, RolesGuard)
@Roles("admin")
export class CohortsController {
	constructor(private readonly cohorts: CohortsService) {}

	@Post()
	@ApiOperation({ summary: "Create a cohort (draft)" })
	create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCohortDto) {
		return this.cohorts.createCohort(user, dto);
	}

	@Get()
	@ApiOperation({ summary: "List all cohorts" })
	list() {
		return this.cohorts.listAll();
	}

	@Get(":id")
	@ApiOperation({
		summary: "Get a cohort for editing",
		description:
			"Includes its courses, assigned instructors/facilitators, and the courses/staff still available to assign.",
	})
	get(@Param("id") id: string) {
		return this.cohorts.getForEdit(id);
	}

	@Patch(":id")
	@ApiOperation({
		summary: "Update cohort settings",
		description:
			"Schedule (start/end/capacity), pricing + Earn-Back, exam mode, unlock mode and grouping configuration.",
	})
	update(@Param("id") id: string, @Body() dto: UpdateCohortDto) {
		return this.cohorts.updateCohort(id, dto);
	}

	@Delete(":id")
	@ApiOperation({ summary: "Delete a cohort" })
	remove(@Param("id") id: string) {
		return this.cohorts.deleteCohort(id);
	}

	@Post(":id/publish")
	@ApiOperation({
		summary: "Open a cohort for enrolment",
		description:
			"Requires a start date and at least one course; returns 422 `COHORT_NOT_PUBLISHABLE` otherwise.",
	})
	publish(@Param("id") id: string) {
		return this.cohorts.publishCohort(id);
	}

	@Post(":id/courses")
	@ApiOperation({ summary: "Add a course to the cohort" })
	addCourse(@Param("id") id: string, @Body() dto: AddCohortCourseDto) {
		return this.cohorts.addCourse(id, dto.courseId);
	}

	@Patch(":id/courses/reorder")
	@ApiOperation({ summary: "Reorder the cohort's courses" })
	reorderCourses(
		@Param("id") id: string,
		@Body() dto: ReorderCohortCoursesDto,
	) {
		return this.cohorts.reorderCourses(id, dto.courseIds);
	}

	@Delete(":id/courses/:courseId")
	@ApiOperation({ summary: "Remove a course from the cohort" })
	removeCourse(@Param("id") id: string, @Param("courseId") courseId: string) {
		return this.cohorts.removeCourse(id, courseId);
	}

	@Post(":id/instructors")
	@ApiOperation({ summary: "Assign an instructor to the cohort" })
	assignInstructor(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: AssignUserDto,
	) {
		return this.cohorts.assignInstructor(user, id, dto.userId);
	}

	@Delete(":id/instructors/:userId")
	@ApiOperation({ summary: "Unassign an instructor" })
	removeInstructor(@Param("id") id: string, @Param("userId") userId: string) {
		return this.cohorts.removeInstructor(id, userId);
	}

	@Post(":id/facilitators")
	@ApiOperation({ summary: "Assign a facilitator to the cohort" })
	assignFacilitator(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: AssignUserDto,
	) {
		return this.cohorts.assignFacilitator(user, id, dto.userId);
	}

	@Delete(":id/facilitators/:userId")
	@ApiOperation({ summary: "Unassign a facilitator" })
	removeFacilitator(@Param("id") id: string, @Param("userId") userId: string) {
		return this.cohorts.removeFacilitator(id, userId);
	}
}
