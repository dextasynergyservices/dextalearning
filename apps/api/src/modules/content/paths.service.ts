import { randomBytes } from "node:crypto";
import {
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
import type { CreatePathDto, UpdatePathDto } from "./dto/paths.dto";

const THUMBNAIL_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};
const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

interface CommercialInput {
	price?: number;
	isFree?: boolean;
	currency?: string;
	isEarnBackEligible?: boolean;
	earnBackPercentage?: number;
	earnBackDeadlineDays?: number;
}

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 180);
}

/** Learning Path authoring (§4.1): ordered courses + path-level pricing/Earn-Back. */
@Injectable()
export class PathsService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
	) {}

	private isOwnerOrAdmin(createdBy: string | null, user: AuthenticatedUser) {
		return user.role === "admin" || createdBy === user.id;
	}

	private async uniqueSlug(title: string): Promise<string> {
		const base = slugify(title) || "path";
		const existing = await this.prisma.learningPath.findUnique({
			where: { slug: base },
			select: { id: true },
		});
		return existing ? `${base}-${randomBytes(3).toString("hex")}` : base;
	}

	private async assertPathOwner(pathId: string, user: AuthenticatedUser) {
		const path = await this.prisma.learningPath.findUnique({
			where: { id: pathId },
			select: { createdBy: true },
		});
		if (!path) throw new NotFoundException("Path not found");
		if (!this.isOwnerOrAdmin(path.createdBy, user)) {
			throw new ForbiddenException("You do not own this path");
		}
	}

	/**
	 * Pricing + Earn-Back rules (§4.1, §4.11): a free path carries no price or
	 * Earn-Back; enabling Earn-Back defaults to 100% of price (it governs the
	 * whole path purchase); disabling it clears the percentage.
	 */
	private normalizeCommercials(dto: CommercialInput): Record<string, unknown> {
		const data: Record<string, unknown> = {};
		if (dto.currency !== undefined) data.currency = dto.currency;
		if (dto.earnBackDeadlineDays !== undefined)
			data.earnBackDeadlineDays = dto.earnBackDeadlineDays;

		if (dto.isFree === true) {
			data.isFree = true;
			data.price = 0;
			data.isEarnBackEligible = false;
			data.earnBackPercentage = null;
			return data;
		}
		if (dto.isFree === false) data.isFree = false;
		if (dto.price !== undefined) data.price = dto.price;

		if (dto.isEarnBackEligible === true) {
			data.isEarnBackEligible = true;
			data.earnBackPercentage = dto.earnBackPercentage ?? 100;
		} else if (dto.isEarnBackEligible === false) {
			data.isEarnBackEligible = false;
			data.earnBackPercentage = null;
		} else if (dto.earnBackPercentage !== undefined) {
			data.earnBackPercentage = dto.earnBackPercentage;
		}
		return data;
	}

	private async withCommercials<
		T extends {
			thumbnailKey: string | null;
			price?: unknown;
			estimatedHours?: unknown;
		},
	>(path: T) {
		return {
			...path,
			price: path.price == null ? null : Number(path.price),
			estimatedHours:
				path.estimatedHours == null ? null : Number(path.estimatedHours),
			thumbnailUrl: path.thumbnailKey
				? await this.storage.getSignedDownloadUrl(path.thumbnailKey)
				: null,
		};
	}

	async createPath(user: AuthenticatedUser, dto: CreatePathDto) {
		return this.prisma.learningPath.create({
			data: {
				title: dto.title,
				slug: await this.uniqueSlug(dto.title),
				description: dto.description,
				level: dto.level,
				tenantId: user.tenantId ?? null,
				createdBy: user.id,
				status: "draft",
			},
		});
	}

	async listMine(user: AuthenticatedUser) {
		const paths = await this.prisma.learningPath.findMany({
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
				estimatedHours: true,
				createdAt: true,
				_count: { select: { pathCourses: true } },
			},
		});
		return Promise.all(paths.map((path) => this.withCommercials(path)));
	}

	async getPathForEdit(user: AuthenticatedUser, pathId: string) {
		const path = await this.prisma.learningPath.findUnique({
			where: { id: pathId },
			include: {
				pathCourses: {
					orderBy: { orderIndex: "asc" },
					include: {
						course: {
							select: {
								id: true,
								title: true,
								slug: true,
								status: true,
								level: true,
								_count: { select: { modules: true } },
							},
						},
					},
				},
			},
		});
		if (!path) throw new NotFoundException("Path not found");
		if (!this.isOwnerOrAdmin(path.createdBy, user)) {
			throw new ForbiddenException("You do not own this path");
		}

		// Courses the author can still add: their own (or, for admins, any) that
		// are not already in this path.
		const inPath = new Set(path.pathCourses.map((pc) => pc.courseId));
		const candidates = await this.prisma.course.findMany({
			where: user.role === "admin" ? {} : { createdBy: user.id },
			orderBy: { createdAt: "desc" },
			select: { id: true, title: true, status: true, level: true },
		});
		const availableCourses = candidates.filter((c) => !inPath.has(c.id));

		return this.withCommercials({ ...path, availableCourses });
	}

	async updatePath(
		user: AuthenticatedUser,
		pathId: string,
		dto: UpdatePathDto,
	) {
		await this.assertPathOwner(pathId, user);
		const {
			price,
			isFree,
			currency,
			isEarnBackEligible,
			earnBackPercentage,
			earnBackDeadlineDays,
			...rest
		} = dto;
		const updated = await this.prisma.learningPath.update({
			where: { id: pathId },
			data: {
				...rest,
				...this.normalizeCommercials({
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

	async deletePath(user: AuthenticatedUser, pathId: string) {
		await this.assertPathOwner(pathId, user);
		const path = await this.prisma.learningPath.findUnique({
			where: { id: pathId },
			select: { thumbnailKey: true },
		});
		if (path?.thumbnailKey) {
			await this.storage.deleteObject(path.thumbnailKey).catch(() => {});
		}
		await this.prisma.learningPath.delete({ where: { id: pathId } });
		return { deleted: true };
	}

	async uploadThumbnail(
		user: AuthenticatedUser,
		pathId: string,
		file: UploadFile,
	) {
		await this.assertPathOwner(pathId, user);
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
		const existing = await this.prisma.learningPath.findUnique({
			where: { id: pathId },
			select: { thumbnailKey: true },
		});
		const key = `paths/${pathId}/thumbnail-${randomBytes(4).toString("hex")}.${ext}`;
		await this.storage.putObject(key, file.buffer, file.mimetype);
		if (existing?.thumbnailKey && existing.thumbnailKey !== key) {
			await this.storage.deleteObject(existing.thumbnailKey).catch(() => {});
		}
		await this.prisma.learningPath.update({
			where: { id: pathId },
			data: { thumbnailKey: key },
		});
		return {
			thumbnailKey: key,
			thumbnailUrl: await this.storage.getSignedDownloadUrl(key),
		};
	}

	async addCourse(
		user: AuthenticatedUser,
		pathId: string,
		courseId: string,
		isRequired = true,
	) {
		await this.assertPathOwner(pathId, user);
		const course = await this.prisma.course.findUnique({
			where: { id: courseId },
			select: { id: true },
		});
		if (!course) throw new NotFoundException("Course not found");
		const last = await this.prisma.pathCourse.aggregate({
			where: { pathId },
			_max: { orderIndex: true },
		});
		await this.prisma.pathCourse.create({
			data: {
				pathId,
				courseId,
				isRequired,
				orderIndex: (last._max.orderIndex ?? 0) + 1,
			},
		});
		return { added: true };
	}

	async removeCourse(
		user: AuthenticatedUser,
		pathId: string,
		courseId: string,
	) {
		await this.assertPathOwner(pathId, user);
		await this.prisma.pathCourse.delete({
			where: { pathId_courseId: { pathId, courseId } },
		});
		return { removed: true };
	}

	async reorderCourses(
		user: AuthenticatedUser,
		pathId: string,
		courseIds: string[],
	) {
		await this.assertPathOwner(pathId, user);
		await this.prisma.$transaction(
			courseIds.map((courseId, index) =>
				this.prisma.pathCourse.update({
					where: { pathId_courseId: { pathId, courseId } },
					data: { orderIndex: index + 1 },
				}),
			),
		);
		return { reordered: true };
	}

	/** Publish gate: a path needs at least one course (§4.1). */
	async publishPath(user: AuthenticatedUser, pathId: string) {
		await this.assertPathOwner(pathId, user);
		const count = await this.prisma.pathCourse.count({ where: { pathId } });
		if (count === 0) {
			throw new UnprocessableEntityException({
				code: "PATH_NOT_PUBLISHABLE",
				message: "Add at least one course before publishing.",
			});
		}
		const updated = await this.prisma.learningPath.update({
			where: { id: pathId },
			data: { status: "published" },
		});
		return this.withCommercials(updated);
	}
}
