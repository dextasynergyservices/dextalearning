import { randomBytes } from "node:crypto";
import {
	Inject,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { LanguageCode } from "../../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import type { UploadFile } from "../media/media.constants";
import type { InstructorOnboardingDto } from "./dto/instructor-onboarding.dto";
import type { LearnerOnboardingDto } from "./dto/learner-onboarding.dto";
import type { UpdateProfileDto } from "./dto/update-profile.dto";

const AVATAR_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const isUrl = (value: string) => /^https?:\/\//.test(value);

/** A timezone is valid iff Intl can construct a formatter with it. */
const isValidTimezone = (value: string) => {
	try {
		new Intl.DateTimeFormat("en-CA", { timeZone: value });
		return true;
	} catch {
		return false;
	}
};

/**
 * Persists onboarding answers + profile edits to the user record (§8.1).
 * Learner preferences feed personalization; instructor fields build the public
 * profile. Avatars upload to R2 (stored as a key in `avatarUrl`, served via a
 * presigned URL), so they never collide with the Better Auth `image` field.
 */
@Injectable()
export class OnboardingService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
	) {}

	async saveLearner(userId: string, dto: LearnerOnboardingDto) {
		await this.prisma.user.update({
			where: { id: userId },
			data: {
				...(dto.language ? { language: dto.language as LanguageCode } : {}),
				...(dto.phone ? { phone: dto.phone } : {}),
				learnerGoals: dto.goals ?? [],
				skillLevel: dto.skillLevel ?? null,
				weeklyHours: dto.weeklyHours ?? null,
				studySchedule: dto.studySchedule ?? null,
				studyAnchor: dto.studyAnchor ?? null,
				whatsappOptIn: dto.whatsappOptIn ?? false,
				onboardedAt: new Date(),
			},
		});
		return { ok: true };
	}

	async saveInstructor(userId: string, dto: InstructorOnboardingDto) {
		await this.prisma.user.update({
			where: { id: userId },
			data: {
				headline: dto.headline ?? null,
				bio: dto.bio ?? null,
				expertiseAreas: dto.expertiseAreas ?? [],
				onboardedAt: new Date(),
			},
		});
		return { ok: true };
	}

	/** Presign an avatar key, or pass through an external (Google) image URL. */
	private async resolveAvatar(
		avatarUrl: string | null,
		image: string | null,
	): Promise<string | null> {
		const key = avatarUrl ?? image;
		if (!key) return null;
		return isUrl(key) ? key : this.storage.getSignedDownloadUrl(key);
	}

	/** Load the current user's editable profile (Studio profile editor). */
	async getProfile(userId: string) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				firstName: true,
				lastName: true,
				otherNames: true,
				fullName: true,
				email: true,
				phone: true,
				phoneVerified: true,
				language: true,
				headline: true,
				bio: true,
				expertiseAreas: true,
				image: true,
				avatarUrl: true,
				whatsappOptIn: true,
				studySchedule: true,
				studyAnchor: true,
				weeklyHours: true,
				timezone: true,
				// Live read: a session can still carry the old value after an admin
				// approves, so anything that reports application status uses this.
				role: true,
				instructorStatus: true,
			},
		});
		if (!user) throw new NotFoundException("User not found");
		return {
			/** Application state (§8.1.1): pending | approved | rejected | null. */
			instructorStatus: user.instructorStatus,
			role: user.role,
			firstName: user.firstName,
			lastName: user.lastName,
			otherNames: user.otherNames,
			name:
				user.fullName?.trim() || `${user.firstName} ${user.lastName}`.trim(),
			email: user.email,
			phone: user.phone,
			phoneVerified: user.phoneVerified,
			language: user.language,
			headline: user.headline,
			bio: user.bio,
			expertiseAreas: user.expertiseAreas,
			image: await this.resolveAvatar(user.avatarUrl, user.image),
			whatsappOptIn: user.whatsappOptIn,
			studySchedule: user.studySchedule,
			studyAnchor: user.studyAnchor,
			weeklyHours: user.weeklyHours,
			timezone: user.timezone,
		};
	}

	/**
	 * Update the full profile from the Studio editor (everything but email).
	 * Recomputes the display name; never touches `onboardedAt`.
	 */
	async updateProfile(userId: string, dto: UpdateProfileDto) {
		const current = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				firstName: true,
				lastName: true,
				otherNames: true,
				phone: true,
			},
		});
		if (!current) throw new NotFoundException("User not found");
		if (dto.timezone !== undefined && !isValidTimezone(dto.timezone)) {
			throw new UnprocessableEntityException({
				code: "INVALID_TIMEZONE",
				message: "Unknown timezone.",
			});
		}

		const firstName = dto.firstName ?? current.firstName;
		const lastName = dto.lastName ?? current.lastName;
		const otherNames =
			dto.otherNames !== undefined
				? dto.otherNames || null
				: current.otherNames;
		const fullName = [firstName, otherNames, lastName]
			.filter(Boolean)
			.join(" ")
			.trim();
		// A new phone is unverified until re-confirmed (matters for the payments
		// phase, where transactional WhatsApp/SMS gate on `phoneVerified`).
		const phoneChanged =
			dto.phone !== undefined && (dto.phone || null) !== current.phone;

		await this.prisma.user.update({
			where: { id: userId },
			data: {
				firstName,
				lastName,
				otherNames,
				fullName,
				name: fullName,
				...(dto.language ? { language: dto.language as LanguageCode } : {}),
				...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
				...(phoneChanged ? { phoneVerified: false } : {}),
				// Only touch instructor fields when provided — so the learner profile
				// page (which omits them) never wipes an instructor's headline/bio.
				...(dto.headline !== undefined
					? { headline: dto.headline || null }
					: {}),
				...(dto.bio !== undefined ? { bio: dto.bio || null } : {}),
				...(dto.expertiseAreas !== undefined
					? { expertiseAreas: dto.expertiseAreas }
					: {}),
				// Learning reminder settings (§3.2) — only when provided, so other
				// profile forms never reset them.
				...(dto.whatsappOptIn !== undefined
					? { whatsappOptIn: dto.whatsappOptIn }
					: {}),
				...(dto.studySchedule !== undefined
					? { studySchedule: dto.studySchedule }
					: {}),
				// "" clears the anchor (the profile select's "no anchor" option).
				...(dto.studyAnchor !== undefined
					? { studyAnchor: dto.studyAnchor || null }
					: {}),
				...(dto.weeklyHours !== undefined
					? { weeklyHours: dto.weeklyHours }
					: {}),
				...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
			},
		});
		return { ok: true };
	}

	/** Upload (replace) the profile avatar → R2; returns the presigned URL. */
	async uploadAvatar(userId: string, file: UploadFile) {
		const ext = AVATAR_TYPES[file.mimetype];
		if (!ext) {
			throw new UnprocessableEntityException({
				code: "MEDIA_UNSUPPORTED_TYPE",
				message: "Avatar must be a PNG, JPG or WebP image.",
			});
		}
		if (file.size > MAX_AVATAR_BYTES) {
			throw new UnprocessableEntityException({
				code: "MEDIA_TOO_LARGE",
				message: "Avatar must be 5 MB or smaller.",
			});
		}
		const existing = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { avatarUrl: true },
		});
		const key = `avatars/${userId}-${randomBytes(4).toString("hex")}.${ext}`;
		await this.storage.putObject(key, file.buffer, file.mimetype);
		// Clean up the previous uploaded avatar (skip external image URLs).
		if (
			existing?.avatarUrl &&
			!isUrl(existing.avatarUrl) &&
			existing.avatarUrl !== key
		) {
			await this.storage.deleteObject(existing.avatarUrl).catch(() => {});
		}
		await this.prisma.user.update({
			where: { id: userId },
			data: { avatarUrl: key },
		});
		return { image: await this.storage.getSignedDownloadUrl(key) };
	}

	/** Remove the uploaded avatar; falls back to the Better Auth image, else null. */
	async deleteAvatar(userId: string) {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { avatarUrl: true, image: true },
		});
		if (user?.avatarUrl && !isUrl(user.avatarUrl)) {
			await this.storage.deleteObject(user.avatarUrl).catch(() => {});
		}
		await this.prisma.user.update({
			where: { id: userId },
			data: { avatarUrl: null },
		});
		return { image: await this.resolveAvatar(null, user?.image ?? null) };
	}
}
