import {
	Body,
	Controller,
	Get,
	Headers,
	Ip,
	Param,
	Patch,
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
import { AttemptsService } from "./attempts.service";
import {
	IngestAntiCheatDto,
	SaveAnswerDto,
	SubmitAttemptDto,
} from "./dto/attempts.dto";

/** Learner-facing assessment attempts (§4.6.3 — server owns the timer + grading). */
@ApiTags("attempts")
@ApiCookieAuth("better-auth.session_token")
@Controller()
@UseGuards(SessionGuard)
export class AttemptsController {
	constructor(private readonly attempts: AttemptsService) {}

	@Get("assessments/:id/info")
	@ApiOperation({
		summary: "Assessment info + eligibility for the current learner",
		description:
			"Pass mark, time limit, question count, retakes remaining, cooldown, best score and any in-progress attempt.",
	})
	info(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
		return this.attempts.getInfo(user, id);
	}

	@Post("assessments/:id/attempts")
	@ApiOperation({
		summary: "Start (or resume) an attempt",
		description:
			"Creates a server-owned attempt with a fixed question set; resumes the in-progress attempt if one exists (attempt locking).",
	})
	start(
		@CurrentUser() user: AuthenticatedUser,
		@Param("id") id: string,
		@Ip() ip: string,
		@Headers("user-agent") userAgent: string,
	) {
		return this.attempts.startOrResume(user, id, ip, userAgent);
	}

	@Get("attempts/:attemptId")
	@ApiOperation({
		summary: "Get attempt state (auto-submits if the timer has expired)",
	})
	get(
		@CurrentUser() user: AuthenticatedUser,
		@Param("attemptId") attemptId: string,
	) {
		return this.attempts.getAttempt(user, attemptId);
	}

	@Patch("attempts/:attemptId/answer")
	@ApiOperation({ summary: "Save one answer (for resume + timing)" })
	answer(
		@CurrentUser() user: AuthenticatedUser,
		@Param("attemptId") attemptId: string,
		@Body() dto: SaveAnswerDto,
	) {
		return this.attempts.saveAnswer(user, attemptId, dto);
	}

	@Post("attempts/:attemptId/submit")
	@ApiOperation({ summary: "Submit + grade the attempt (server-side)" })
	submit(
		@CurrentUser() user: AuthenticatedUser,
		@Param("attemptId") attemptId: string,
		@Body() dto: SubmitAttemptDto,
	) {
		return this.attempts.submit(user, attemptId, dto);
	}

	@Get("attempts/:attemptId/result")
	@ApiOperation({ summary: "Get the graded result + per-question review" })
	result(
		@CurrentUser() user: AuthenticatedUser,
		@Param("attemptId") attemptId: string,
	) {
		return this.attempts.getResult(user, attemptId);
	}

	@Post("attempts/:attemptId/anti-cheat")
	@ApiOperation({
		summary: "Batch-ingest anti-cheat events (§4.6.3)",
		description:
			"Stores client-side integrity events, recomputes the integrity score, and signals when a threshold (tab switches / fullscreen exits) is crossed.",
	})
	antiCheat(
		@CurrentUser() user: AuthenticatedUser,
		@Param("attemptId") attemptId: string,
		@Body() dto: IngestAntiCheatDto,
	) {
		return this.attempts.ingestAntiCheat(user, attemptId, dto);
	}

	@Post("attempts/:attemptId/proctoring")
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }),
	)
	@ApiOperation({
		summary: "Upload a camera-monitoring snapshot + flag (§4.6.2)",
		description:
			"Stores the thumbnail in R2 under proctoring/{attemptId}/, logs the camera flag, and recomputes integrity. eventType is camera_face_missing or camera_multiple_faces.",
	})
	proctoring(
		@CurrentUser() user: AuthenticatedUser,
		@Param("attemptId") attemptId: string,
		@UploadedFile() file: UploadFile,
		@Body("eventType") eventType: string,
	) {
		return this.attempts.ingestProctoringSnapshot(
			user,
			attemptId,
			file,
			eventType,
		);
	}
}
