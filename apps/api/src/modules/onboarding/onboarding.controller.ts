import {
	Body,
	Controller,
	Delete,
	Get,
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
import { SessionGuard } from "../../auth/guards/session.guard";
import type { AuthenticatedUser } from "../../auth/types";
import type { UploadFile } from "../media/media.constants";
import { InstructorOnboardingDto } from "./dto/instructor-onboarding.dto";
import { LearnerOnboardingDto } from "./dto/learner-onboarding.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { OnboardingService } from "./onboarding.service";

/** Persist onboarding answers + profile edits for the signed-in user (§8.1). */
@ApiTags("onboarding")
@ApiCookieAuth("better-auth.session_token")
@Controller("onboarding")
@UseGuards(SessionGuard)
export class OnboardingController {
	constructor(private readonly onboarding: OnboardingService) {}

	@Post("learner")
	@ApiOperation({ summary: "Save learner onboarding preferences (§8.1)" })
	learner(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: LearnerOnboardingDto,
	) {
		return this.onboarding.saveLearner(user.id, dto);
	}

	@Post("instructor")
	@ApiOperation({ summary: "Save instructor profile from onboarding (§8.1.1)" })
	instructor(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: InstructorOnboardingDto,
	) {
		return this.onboarding.saveInstructor(user.id, dto);
	}

	@Get("profile")
	@ApiOperation({ summary: "Load the signed-in user's editable profile" })
	getProfile(@CurrentUser() user: AuthenticatedUser) {
		return this.onboarding.getProfile(user.id);
	}

	@Patch("profile")
	@ApiOperation({ summary: "Update the full profile from the Studio" })
	updateProfile(
		@CurrentUser() user: AuthenticatedUser,
		@Body() dto: UpdateProfileDto,
	) {
		return this.onboarding.updateProfile(user.id, dto);
	}

	@Post("avatar")
	@UseInterceptors(
		FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
	)
	@ApiOperation({ summary: "Upload (replace) the profile avatar" })
	uploadAvatar(
		@CurrentUser() user: AuthenticatedUser,
		@UploadedFile() file: UploadFile,
	) {
		if (!file) {
			throw new UnprocessableEntityException({
				code: "MEDIA_FILE_REQUIRED",
				message: "No image was uploaded.",
			});
		}
		return this.onboarding.uploadAvatar(user.id, file);
	}

	@Delete("avatar")
	@ApiOperation({ summary: "Remove the uploaded profile avatar" })
	deleteAvatar(@CurrentUser() user: AuthenticatedUser) {
		return this.onboarding.deleteAvatar(user.id);
	}
}
