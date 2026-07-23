import {
	Body,
	Controller,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { AdminUsersService } from "./admin-users.service";
import { SetRoleDto, SuspendUserDto } from "./dto/admin-users.dto";

/**
 * Admin user management (§8.7). Admin-only: browse/search every account,
 * change a global role, and suspend or restore access. The service holds the
 * invariants (no self-demotion, never strand the last admin).
 */
@ApiTags("admin-users")
@ApiCookieAuth("better-auth.session_token")
@Controller("admin/users")
@UseGuards(SessionGuard, RolesGuard)
@Roles("admin")
export class AdminUsersController {
	constructor(private readonly users: AdminUsersService) {}

	@Get()
	@ApiOperation({ summary: "Browse/search users with role + status filters" })
	list(
		@Query("search") search?: string,
		@Query("role") role?: string,
		@Query("status") status?: "active" | "suspended",
		@Query("page") page?: string,
		@Query("pageSize") pageSize?: string,
	) {
		return this.users.list({
			search,
			role,
			status,
			page: Number(page) || 1,
			pageSize: Number(pageSize) || 25,
		});
	}

	// ── Instructor applications (§5) ─────────────────────────────────────────
	// Declared before `:id/…` routes so "instructor-applications" is never
	// swallowed as a user id.
	@Get("instructor-applications")
	@ApiOperation({
		summary: "Instructor applications awaiting a decision",
		description:
			"Self-service sign-up can request `instructor`, but the role is only granted here — applicants stay learners until approved.",
	})
	instructorApplications() {
		return this.users.listInstructorApplications();
	}

	@Post("instructor-applications/:id/approve")
	@ApiOperation({
		summary: "Approve an instructor application (grants the role)",
	})
	approveInstructor(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id") id: string,
	) {
		return this.users.decideInstructorApplication(actor, id, true);
	}

	@Post("instructor-applications/:id/reject")
	@ApiOperation({
		summary: "Reject an instructor application (stays a learner)",
	})
	rejectInstructor(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id") id: string,
	) {
		return this.users.decideInstructorApplication(actor, id, false);
	}

	@Patch(":id/role")
	@ApiOperation({ summary: "Change a user's global role" })
	setRole(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: SetRoleDto,
	) {
		return this.users.setRole(actor, id, dto.role);
	}

	@Post(":id/suspend")
	@ApiOperation({ summary: "Suspend an account and revoke its sessions" })
	suspend(
		@CurrentUser() actor: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: SuspendUserDto,
	) {
		return this.users.suspend(actor, id, dto.reason);
	}

	@Post(":id/restore")
	@ApiOperation({ summary: "Lift a suspension" })
	restore(@CurrentUser() actor: AuthenticatedUser, @Param("id") id: string) {
		return this.users.restore(actor, id);
	}

	@Post(":id/sign-out")
	@ApiOperation({ summary: "Revoke every session without suspending" })
	signOut(@CurrentUser() actor: AuthenticatedUser, @Param("id") id: string) {
		return this.users.signOutEverywhere(actor, id);
	}
}
