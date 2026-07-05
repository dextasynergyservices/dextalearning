import { randomBytes } from "node:crypto";
import {
	BadRequestException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../../auth/types";
import { PrismaService } from "../../prisma/prisma.service";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import type { UploadFile } from "../media/media.constants";
import { normalizeCommercials } from "./commercials.calculator";
import type {
	CreateCourseDto,
	CreateLessonDto,
	CreateModuleDto,
	UpdateCourseDto,
	UpdateLessonDto,
} from "./dto/authoring.dto";

const THUMBNAIL_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 180);
}

@Injectable()
export class AuthoringService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
	) {}

	private isOwnerOrAdmin(createdBy: string | null, user: AuthenticatedUser) {
		return user.role === "admin" || createdBy === user.id;
	}

	private serializeLesson<
		T extends { audioSizeBytes?: bigint | number | null },
	>(lesson: T): Omit<T, "audioSizeBytes"> & { audioSizeBytes?: number | null } {
		return {
			...lesson,
			audioSizeBytes:
				typeof lesson.audioSizeBytes === "bigint"
					? Number(lesson.audioSizeBytes)
					: lesson.audioSizeBytes,
		};
	}

	private async uniqueSlug(title: string): Promise<string> {
		const base = slugify(title) || "course";
		const existing = await this.prisma.course.findUnique({
			where: { slug: base },
			select: { id: true },
		});
		return existing ? `${base}-${randomBytes(3).toString("hex")}` : base;
	}

	/** Attach a presigned thumbnail URL (Decimal `price` → number for the client). */
	private async withCommercials<
		T extends { thumbnailKey: string | null; price?: unknown },
	>(course: T): Promise<T & { thumbnailUrl: string | null; price?: number }> {
		return {
			...course,
			price: course.price == null ? undefined : Number(course.price),
			thumbnailUrl: course.thumbnailKey
				? await this.storage.getSignedDownloadUrl(course.thumbnailKey)
				: null,
		};
	}

	// ── Courses ──────────────────────────────────────────────────────────
	async createCourse(user: AuthenticatedUser, dto: CreateCourseDto) {
		const { title, description, level, language, ...commercial } = dto;
		return this.prisma.course.create({
			data: {
				title,
				slug: await this.uniqueSlug(title),
				description,
				level,
				language: language ?? "en",
				tenantId: user.tenantId ?? null,
				createdBy: user.id,
				status: "draft",
				...normalizeCommercials(commercial),
			},
		});
	}

	async listMine(user: AuthenticatedUser) {
		const courses = await this.prisma.course.findMany({
			where: user.role === "admin" ? {} : { createdBy: user.id },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				title: true,
				slug: true,
				status: true,
				level: true,
				thumbnailKey: true,
				price: true,
				isFree: true,
				currency: true,
				isEarnBackEligible: true,
				earnBackPercentage: true,
				createdAt: true,
				_count: { select: { modules: true } },
			},
		});
		return Promise.all(courses.map((course) => this.withCommercials(course)));
	}

	async getCourseForEdit(user: AuthenticatedUser, courseId: string) {
		const course = await this.prisma.course.findUnique({
			where: { id: courseId },
			include: {
				modules: {
					orderBy: { orderIndex: "asc" },
					include: { lessons: { orderBy: { orderIndex: "asc" } } },
				},
			},
		});
		if (!course) throw new NotFoundException("Course not found");
		if (!this.isOwnerOrAdmin(course.createdBy, user)) {
			throw new ForbiddenException("You do not own this course");
		}
		return this.withCommercials({
			...course,
			modules: course.modules.map((mod) => ({
				...mod,
				lessons: mod.lessons.map((lesson) => this.serializeLesson(lesson)),
			})),
		});
	}

	async updateCourse(
		user: AuthenticatedUser,
		courseId: string,
		dto: UpdateCourseDto,
	) {
		await this.assertCourseOwner(courseId, user);
		const {
			price,
			isFree,
			currency,
			isEarnBackEligible,
			earnBackPercentage,
			earnBackDeadlineDays,
			isFeatured,
			...rest
		} = dto;
		// Featuring is admin-only; instructors set `featureRequested` (in ...rest).
		// When an admin sets `isFeatured`, any pending request is resolved.
		const featuring =
			user.role === "admin" && isFeatured !== undefined
				? { isFeatured, featureRequested: false }
				: {};
		const updated = await this.prisma.course.update({
			where: { id: courseId },
			data: {
				...rest,
				...featuring,
				...normalizeCommercials({
					price,
					isFree,
					currency,
					isEarnBackEligible,
					earnBackPercentage,
					earnBackDeadlineDays,
				}),
			},
		});
		return this.withCommercials(updated);
	}

	/** Upload (replace) a course thumbnail image → R2; returns the presigned URL. */
	async uploadCourseThumbnail(
		user: AuthenticatedUser,
		courseId: string,
		file: UploadFile,
	) {
		await this.assertCourseOwner(courseId, user);
		const ext = THUMBNAIL_TYPES[file.mimetype];
		if (!ext) {
			throw new UnprocessableEntityException({
				code: "MEDIA_UNSUPPORTED_TYPE",
				message: "Thumbnail must be a PNG, JPG or WebP image.",
			});
		}
		if (file.size > MAX_THUMBNAIL_BYTES) {
			throw new UnprocessableEntityException({
				code: "MEDIA_TOO_LARGE",
				message: "Thumbnail must be 5 MB or smaller.",
			});
		}
		const existing = await this.prisma.course.findUnique({
			where: { id: courseId },
			select: { thumbnailKey: true },
		});
		const key = `courses/${courseId}/thumbnail-${randomBytes(4).toString("hex")}.${ext}`;
		await this.storage.putObject(key, file.buffer, file.mimetype);
		if (existing?.thumbnailKey && existing.thumbnailKey !== key) {
			await this.storage.deleteObject(existing.thumbnailKey).catch(() => {});
		}
		await this.prisma.course.update({
			where: { id: courseId },
			data: { thumbnailKey: key },
		});
		return {
			thumbnailKey: key,
			thumbnailUrl: await this.storage.getSignedDownloadUrl(key),
		};
	}

	async deleteCourse(user: AuthenticatedUser, courseId: string) {
		await this.assertCourseOwner(courseId, user);
		await this.deleteCourseMediaObjects(courseId);
		await this.prisma.course.delete({ where: { id: courseId } });
		return { deleted: true };
	}

	/** Publish gate (§4.2): every lesson needs content + a transcript (§4.3). */
	async publishCourse(user: AuthenticatedUser, courseId: string) {
		const course = await this.getCourseForEdit(user, courseId);
		const issues: { lessonId?: string; title?: string; reason: string }[] = [];
		let lessonCount = 0;

		for (const mod of course.modules) {
			for (const lesson of mod.lessons) {
				lessonCount += 1;
				const tag = { lessonId: lesson.id, title: lesson.title };
				if (!lesson.contentType) {
					issues.push({ ...tag, reason: "no_content_type" });
					continue;
				}
				if (!lesson.transcriptText?.trim()) {
					issues.push({ ...tag, reason: "missing_transcript" });
				}
				if (lesson.contentType === "video" && !lesson.videoKeysJson) {
					issues.push({ ...tag, reason: "video_not_encoded" });
				}
				if (lesson.contentType === "audio" && !lesson.audioKey) {
					issues.push({ ...tag, reason: "audio_not_encoded" });
				}
				if (lesson.contentType === "text" && !lesson.contentText) {
					issues.push({ ...tag, reason: "empty_text" });
				}
				if (lesson.contentType === "pdf" && !lesson.pdfKey) {
					issues.push({ ...tag, reason: "missing_pdf" });
				}
			}
		}
		if (lessonCount === 0) issues.push({ reason: "no_lessons" });

		if (issues.length > 0) {
			throw new UnprocessableEntityException({
				code: "COURSE_NOT_PUBLISHABLE",
				message: "errors.content.not_publishable",
				details: { issues },
			});
		}
		return this.prisma.course.update({
			where: { id: courseId },
			data: { status: "published" },
		});
	}

	// ── Modules ──────────────────────────────────────────────────────────
	async createModule(
		user: AuthenticatedUser,
		courseId: string,
		dto: CreateModuleDto,
	) {
		await this.assertCourseOwner(courseId, user);
		const count = await this.prisma.module.count({ where: { courseId } });
		return this.prisma.module.create({
			data: { courseId, title: dto.title, orderIndex: count + 1 },
		});
	}

	async renameModule(user: AuthenticatedUser, moduleId: string, title: string) {
		await this.assertModuleOwner(moduleId, user);
		return this.prisma.module.update({
			where: { id: moduleId },
			data: { title },
		});
	}

	async deleteModule(user: AuthenticatedUser, moduleId: string) {
		await this.assertModuleOwner(moduleId, user);
		await this.prisma.module.delete({ where: { id: moduleId } });
		return { deleted: true };
	}

	// ── Lessons ──────────────────────────────────────────────────────────
	async createLesson(
		user: AuthenticatedUser,
		moduleId: string,
		dto: CreateLessonDto,
	) {
		await this.assertModuleOwner(moduleId, user);
		const count = await this.prisma.lesson.count({ where: { moduleId } });
		return this.prisma.lesson.create({
			data: {
				moduleId,
				title: dto.title,
				contentType: dto.contentType,
				orderIndex: count + 1,
			},
		});
	}

	async getLessonForEdit(user: AuthenticatedUser, lessonId: string) {
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
			include: {
				captions: true,
				module: { include: { course: { select: { createdBy: true } } } },
				introForPath: { select: { createdBy: true } },
				introForCohort: { select: { createdBy: true } },
			},
		});
		if (!lesson) throw new NotFoundException("Lesson not found");
		const ownerId =
			lesson.module?.course.createdBy ??
			lesson.introForPath?.createdBy ??
			lesson.introForCohort?.createdBy ??
			null;
		if (!this.isOwnerOrAdmin(ownerId, user)) {
			throw new ForbiddenException("You do not own this content");
		}
		return this.serializeLesson(lesson);
	}

	async updateLesson(
		user: AuthenticatedUser,
		lessonId: string,
		dto: UpdateLessonDto,
	) {
		await this.assertLessonOwner(lessonId, user);
		// Must serialize: audio lessons carry a BIGINT `audioSizeBytes` that
		// JSON cannot stringify — returning the raw row 500s the response.
		const lesson = await this.prisma.lesson.update({
			where: { id: lessonId },
			data: dto,
		});
		return this.serializeLesson(lesson);
	}

	async deleteLesson(user: AuthenticatedUser, lessonId: string) {
		await this.assertLessonOwner(lessonId, user);
		await this.prisma.lesson.delete({ where: { id: lessonId } });
		return { deleted: true };
	}

	/** Persist a new lesson order within a module (drag/up-down reordering). */
	async reorderLessons(
		user: AuthenticatedUser,
		moduleId: string,
		lessonIds: string[],
	) {
		await this.assertModuleOwner(moduleId, user);
		const existing = await this.prisma.lesson.findMany({
			where: { moduleId },
			select: { id: true },
		});
		const valid = new Set(existing.map((lesson) => lesson.id));
		if (
			lessonIds.length !== valid.size ||
			lessonIds.some((id) => !valid.has(id))
		) {
			throw new BadRequestException("Lesson set does not match this module");
		}
		await this.prisma.$transaction(
			lessonIds.map((id, index) =>
				this.prisma.lesson.update({
					where: { id },
					data: { orderIndex: index + 1 },
				}),
			),
		);
		return { reordered: true };
	}

	// ── Ownership helpers ────────────────────────────────────────────────
	private async assertCourseOwner(courseId: string, user: AuthenticatedUser) {
		const course = await this.prisma.course.findUnique({
			where: { id: courseId },
			select: { id: true, createdBy: true },
		});
		if (!course) throw new NotFoundException("Course not found");
		if (!this.isOwnerOrAdmin(course.createdBy, user)) {
			throw new ForbiddenException("You do not own this course");
		}
		return course;
	}

	private async deleteCourseMediaObjects(courseId: string): Promise<void> {
		const lessons = await this.prisma.lesson.findMany({
			where: { module: { courseId } },
			select: { id: true },
		});
		await Promise.all(
			lessons.flatMap((lesson) =>
				[
					`videos/${lesson.id}/`,
					`audio/${lesson.id}/`,
					`pdfs/${lesson.id}/`,
					`captions/${lesson.id}/`,
					`uploads/source/${lesson.id}/`,
				].map((prefix) => this.deletePrefix(prefix)),
			),
		);
	}

	private async deletePrefix(prefix: string): Promise<void> {
		const keys = await this.storage.listKeys(prefix);
		await Promise.all(
			keys.map((key) => this.storage.deleteObject(key).catch(() => {})),
		);
	}

	private async assertModuleOwner(moduleId: string, user: AuthenticatedUser) {
		const mod = await this.prisma.module.findUnique({
			where: { id: moduleId },
			include: { course: { select: { createdBy: true } } },
		});
		if (!mod) throw new NotFoundException("Module not found");
		if (!this.isOwnerOrAdmin(mod.course.createdBy, user)) {
			throw new ForbiddenException("You do not own this course");
		}
		return mod;
	}

	private async assertLessonOwner(lessonId: string, user: AuthenticatedUser) {
		const lesson = await this.prisma.lesson.findUnique({
			where: { id: lessonId },
			include: {
				module: { include: { course: { select: { createdBy: true } } } },
				introForPath: { select: { createdBy: true } },
				introForCohort: { select: { createdBy: true } },
			},
		});
		if (!lesson) throw new NotFoundException("Lesson not found");
		const ownerId =
			lesson.module?.course.createdBy ??
			lesson.introForPath?.createdBy ??
			lesson.introForCohort?.createdBy ??
			null;
		if (!this.isOwnerOrAdmin(ownerId, user)) {
			throw new ForbiddenException("You do not own this content");
		}
		return lesson;
	}
}
