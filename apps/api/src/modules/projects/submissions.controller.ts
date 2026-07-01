import {
	Body,
	Controller,
	Get,
	Param,
	Post,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import type { UploadFile } from "../media/media.constants";
import { SubmitPeerReviewDto, SubmitProjectDto } from "./dto/submissions.dto";
import { SubmissionsService } from "./submissions.service";

/** Learner-facing project submission (§4.5). */
@ApiTags("project-submissions")
@ApiCookieAuth("better-auth.session_token")
@Controller()
@UseGuards(SessionGuard)
export class SubmissionsController {
	constructor(private readonly submissions: SubmissionsService) {}

	@Get("projects/:id/info")
	@ApiOperation({
		summary: "Project info + the learner's own submission status",
	})
	info(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.submissions.getProjectInfo(user, id);
	}

	@Post("projects/:id/files")
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: 500 * 1024 * 1024 } }),
	)
	@ApiOperation({ summary: "Upload a submission file → returns its key + URL" })
	upload(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@UploadedFile() file: UploadFile,
	) {
		return this.submissions.uploadFile(user, id, file);
	}

	@Post("projects/:id/submit")
	@ApiOperation({ summary: "Submit the project (text / URL / uploaded files)" })
	submit(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Body() dto: SubmitProjectDto,
	) {
		return this.submissions.submit(user, id, dto);
	}

	@Get("projects/:id/peer-reviews")
	@ApiOperation({
		summary: "Peer reviews assigned to this learner (lazily assigned) (§4.5)",
	})
	peerReviews(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.submissions.listMyReviews(user, id);
	}

	@Post("peer-reviews/:reviewId")
	@ApiOperation({ summary: "Submit a peer review (rubric scores + feedback)" })
	submitReview(
		@CurrentUser() user: AuthenticatedUser,
		@Param("reviewId") reviewId: string,
		@Body() dto: SubmitPeerReviewDto,
	) {
		return this.submissions.submitReview(user, reviewId, dto);
	}
}
