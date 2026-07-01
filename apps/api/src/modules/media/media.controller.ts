import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UnprocessableEntityException,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import { UpdateTranscriptDto } from "./dto/update-transcript.dto";
import {
	LANGUAGE_CODES,
	MAX_AUDIO_BYTES,
	MAX_CAPTION_BYTES,
	MAX_VIDEO_BYTES,
	type SupportedLanguage,
	type UploadFile,
} from "./media.constants";
import { MediaService } from "./media.service";

const MEDIA_JOB_KINDS = ["video", "audio", "caption"] as const;
type MediaJobKind = (typeof MEDIA_JOB_KINDS)[number];

/**
 * Instructor media uploads + protected playback delivery for lessons (§12).
 * Uploads require the instructor/admin role; `media-token` only requires a
 * session (enrolment gating arrives with payments).
 */
@ApiTags("media")
@Controller("lessons")
export class MediaController {
	constructor(private readonly media: MediaService) {}

	@Post(":lessonId/video")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("instructor", "admin")
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: MAX_VIDEO_BYTES } }),
	)
	@ApiOperation({
		summary: "Upload a video (validated + queued for 6-quality encode)",
	})
	uploadVideo(
		@Param("lessonId") lessonId: string,
		@CurrentUser() user: AuthenticatedUser,
		@UploadedFile() file: UploadFile,
	) {
		this.assertFile(file);
		return this.media.uploadVideo(lessonId, user, file);
	}

	@Post(":lessonId/audio")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("instructor", "admin")
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: MAX_AUDIO_BYTES } }),
	)
	@ApiOperation({ summary: "Upload audio (validated + queued for AAC encode)" })
	uploadAudio(
		@Param("lessonId") lessonId: string,
		@CurrentUser() user: AuthenticatedUser,
		@UploadedFile() file: UploadFile,
	) {
		this.assertFile(file);
		return this.media.uploadAudio(lessonId, user, file);
	}

	@Post(":lessonId/pdf")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("instructor", "admin")
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: MAX_AUDIO_BYTES } }),
	)
	@ApiOperation({ summary: "Upload a PDF lesson document" })
	uploadPdf(
		@Param("lessonId") lessonId: string,
		@CurrentUser() user: AuthenticatedUser,
		@UploadedFile() file: UploadFile,
	) {
		this.assertFile(file);
		return this.media.uploadPdf(lessonId, user, file);
	}

	@Post(":lessonId/captions/:language")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("instructor", "admin")
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: MAX_CAPTION_BYTES } }),
	)
	@ApiOperation({ summary: "Upload a .vtt/.srt caption for a language" })
	uploadCaption(
		@Param("lessonId") lessonId: string,
		@Param("language") language: string,
		@CurrentUser() user: AuthenticatedUser,
		@UploadedFile() file: UploadFile,
	) {
		this.assertFile(file);
		if (!LANGUAGE_CODES.includes(language as SupportedLanguage)) {
			throw new UnprocessableEntityException({
				code: "UNSUPPORTED_LANGUAGE",
				message: "errors.media.unsupported_language",
				details: { supported: LANGUAGE_CODES },
			});
		}
		return this.media.uploadCaption(
			lessonId,
			user,
			language as SupportedLanguage,
			file,
		);
	}

	@Patch(":lessonId/transcript")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("instructor", "admin")
	@ApiOperation({
		summary: "Set the lesson transcript (required before publish)",
	})
	updateTranscript(
		@Param("lessonId") lessonId: string,
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: UpdateTranscriptDto,
	) {
		return this.media.updateTranscript(lessonId, user, dto.text, dto.cues);
	}

	@Get(":lessonId/media-token")
	@UseGuards(SessionGuard)
	@ApiOperation({
		summary: "Presigned playback URLs + captions + transcript (2h)",
	})
	getMediaToken(
		@Param("lessonId") lessonId: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.media.getMediaToken(lessonId, user);
	}

	@Get(":lessonId/preview-media-token")
	@ApiOperation({
		summary: "Public playback for a free-preview lesson (no auth — §2.4)",
	})
	getPreviewMediaToken(@Param("lessonId") lessonId: string) {
		return this.media.getPreviewMediaToken(lessonId);
	}

	@Get(":lessonId/intro-media-token")
	@ApiOperation({
		summary: "Public playback for a path/cohort intro lesson (no auth)",
	})
	getIntroMediaToken(@Param("lessonId") lessonId: string) {
		return this.media.getIntroMediaToken(lessonId);
	}

	@Get(":lessonId/media-status")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("instructor", "admin")
	@ApiOperation({
		summary: "Current BullMQ media job progress for a lesson",
	})
	getMediaStatus(
		@Param("lessonId") lessonId: string,
		@Query("kind") kind: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		if (!MEDIA_JOB_KINDS.includes(kind as MediaJobKind)) {
			throw new UnprocessableEntityException({
				code: "UNSUPPORTED_MEDIA_JOB_KIND",
				message: "errors.media.unsupported_job_kind",
				details: { supported: MEDIA_JOB_KINDS },
			});
		}
		return this.media.getMediaJobStatus(lessonId, user, kind as MediaJobKind);
	}

	@Delete(":lessonId/video")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("instructor", "admin")
	@ApiOperation({ summary: "Remove the lesson's video (and renditions)" })
	removeVideo(
		@Param("lessonId") lessonId: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.media.removeMedia(lessonId, user, "video");
	}

	@Delete(":lessonId/audio")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("instructor", "admin")
	@ApiOperation({ summary: "Remove the lesson's audio" })
	removeAudio(
		@Param("lessonId") lessonId: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.media.removeMedia(lessonId, user, "audio");
	}

	@Delete(":lessonId/pdf")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("instructor", "admin")
	@ApiOperation({ summary: "Remove the lesson's PDF (and page images)" })
	removePdf(
		@Param("lessonId") lessonId: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		return this.media.removeMedia(lessonId, user, "pdf");
	}

	@Delete(":lessonId/captions/:language")
	@UseGuards(SessionGuard, RolesGuard)
	@Roles("instructor", "admin")
	@ApiOperation({ summary: "Remove a language caption" })
	removeCaption(
		@Param("lessonId") lessonId: string,
		@Param("language") language: string,
		@CurrentUser() user: AuthenticatedUser,
	) {
		if (!LANGUAGE_CODES.includes(language as SupportedLanguage)) {
			throw new UnprocessableEntityException({
				code: "UNSUPPORTED_LANGUAGE",
				message: "errors.media.unsupported_language",
			});
		}
		return this.media.removeCaption(
			lessonId,
			user,
			language as SupportedLanguage,
		);
	}

	private assertFile(file: UploadFile | undefined): asserts file is UploadFile {
		if (!file) {
			throw new UnprocessableEntityException({
				code: "FILE_REQUIRED",
				message: "errors.media.file_required",
			});
		}
	}
}
