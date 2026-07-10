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
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import {
	CreateGroupDto,
	ManualAssignDto,
	RenameGroupDto,
	SetLeadDto,
} from "./dto/grouping.dto";
import { GroupingService } from "./grouping.service";

/**
 * Group management (§4.7). Only `SessionGuard` gates the route — authority is
 * per-cohort, not a global role: the service admits admins and anyone assigned
 * as this cohort's facilitator (which can be any user), and rejects everyone
 * else with 403.
 */
@ApiTags("grouping")
@ApiCookieAuth("better-auth.session_token")
@Controller("cohorts/:cohortId/grouping")
@UseGuards(SessionGuard)
export class GroupingController {
	constructor(private readonly grouping: GroupingService) {}

	@Get()
	@ApiOperation({
		summary:
			"The grouping board — config, groups + members, and the unassigned",
	})
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Param("cohortId") cohortId: string,
	) {
		return this.grouping.listGroups(user, cohortId);
	}

	@Post("generate")
	@ApiOperation({
		summary: "(Re)generate groups from the cohort's configured mode",
		description:
			"Wipes and rebuilds the grouping. On a re-group, learners whose group changed are notified (§8.6).",
	})
	generate(
		@CurrentUser() user: AuthenticatedUser,
		@Param("cohortId") cohortId: string,
	) {
		return this.grouping.generateGroups(user, cohortId);
	}

	@Post("assign")
	@ApiOperation({
		summary: "Move a learner into a group (manual drag-and-drop)",
	})
	assign(
		@CurrentUser() user: AuthenticatedUser,
		@Param("cohortId") cohortId: string,
		@Body() dto: ManualAssignDto,
	) {
		return this.grouping.manualAssign(user, cohortId, dto.userId, dto.groupId);
	}

	@Post("groups")
	@ApiOperation({ summary: "Create an empty group" })
	createGroup(
		@CurrentUser() user: AuthenticatedUser,
		@Param("cohortId") cohortId: string,
		@Body() dto: CreateGroupDto,
	) {
		return this.grouping.createGroup(user, cohortId, dto.name);
	}

	@Patch("groups/:groupId")
	@ApiOperation({ summary: "Rename a group" })
	renameGroup(
		@CurrentUser() user: AuthenticatedUser,
		@Param("cohortId") cohortId: string,
		@Param("groupId") groupId: string,
		@Body() dto: RenameGroupDto,
	) {
		return this.grouping.renameGroup(user, cohortId, groupId, dto.name);
	}

	@Delete("groups/:groupId")
	@ApiOperation({ summary: "Delete a group (its members become unassigned)" })
	deleteGroup(
		@CurrentUser() user: AuthenticatedUser,
		@Param("cohortId") cohortId: string,
		@Param("groupId") groupId: string,
	) {
		return this.grouping.deleteGroup(user, cohortId, groupId);
	}

	@Post("groups/:groupId/lead")
	@ApiOperation({ summary: "Promote a member to group lead" })
	setLead(
		@CurrentUser() user: AuthenticatedUser,
		@Param("cohortId") cohortId: string,
		@Param("groupId") groupId: string,
		@Body() dto: SetLeadDto,
	) {
		return this.grouping.setLead(user, cohortId, groupId, dto.userId);
	}
}
