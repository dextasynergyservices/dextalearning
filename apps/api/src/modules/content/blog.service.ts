import { randomBytes } from "node:crypto";
import {
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
import type { CreateBlogPostDto, UpdateBlogPostDto } from "./dto/blog.dto";

const COVER_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};
const MAX_COVER_BYTES = 5 * 1024 * 1024;

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 180);
}

/** Estimated read time from HTML body (~200 wpm). */
function readMinutesOf(html?: string | null): number {
	const text = (html ?? "").replace(/<[^>]*>/g, " ").trim();
	const words = text ? text.split(/\s+/).length : 0;
	return Math.max(1, Math.ceil(words / 200));
}

/** Blog authoring (Admin only) + cover images. */
@Injectable()
export class BlogService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
	) {}

	private async uniqueSlug(title: string): Promise<string> {
		const base = slugify(title) || "post";
		const existing = await this.prisma.blogPost.findUnique({
			where: { slug: base },
			select: { id: true },
		});
		return existing ? `${base}-${randomBytes(3).toString("hex")}` : base;
	}

	private async withCover<T extends { coverKey: string | null }>(post: T) {
		return {
			...post,
			coverUrl: post.coverKey
				? await this.storage.getSignedDownloadUrl(post.coverKey)
				: null,
		};
	}

	async createPost(user: AuthenticatedUser, dto: CreateBlogPostDto) {
		return this.prisma.blogPost.create({
			data: {
				title: dto.title,
				slug: await this.uniqueSlug(dto.title),
				authorName: user.name ?? null,
				tenantId: user.tenantId ?? null,
				createdBy: user.id,
				status: "draft",
			},
		});
	}

	async listAll() {
		return this.prisma.blogPost.findMany({
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				title: true,
				slug: true,
				excerpt: true,
				category: true,
				status: true,
				authorName: true,
				readMinutes: true,
				publishedAt: true,
				createdAt: true,
			},
		});
	}

	async getForEdit(id: string) {
		const post = await this.prisma.blogPost.findUnique({ where: { id } });
		if (!post) throw new NotFoundException("Post not found");
		return this.withCover(post);
	}

	async updatePost(id: string, dto: UpdateBlogPostDto) {
		const exists = await this.prisma.blogPost.findUnique({
			where: { id },
			select: { id: true },
		});
		if (!exists) throw new NotFoundException("Post not found");
		const updated = await this.prisma.blogPost.update({
			where: { id },
			data: {
				...dto,
				...(dto.bodyHtml !== undefined
					? { readMinutes: readMinutesOf(dto.bodyHtml) }
					: {}),
			},
		});
		return this.withCover(updated);
	}

	async deletePost(id: string) {
		const post = await this.prisma.blogPost.findUnique({
			where: { id },
			select: { coverKey: true },
		});
		if (!post) throw new NotFoundException("Post not found");
		if (post.coverKey) {
			await this.storage.deleteObject(post.coverKey).catch(() => {});
		}
		await this.prisma.blogPost.delete({ where: { id } });
		return { deleted: true };
	}

	async uploadCover(id: string, file: UploadFile) {
		const post = await this.prisma.blogPost.findUnique({
			where: { id },
			select: { coverKey: true },
		});
		if (!post) throw new NotFoundException("Post not found");
		const ext = COVER_TYPES[file.mimetype];
		if (!ext) {
			throw new UnprocessableEntityException({
				code: "MEDIA_UNSUPPORTED_TYPE",
				message: "Cover must be a PNG, JPG or WebP image.",
			});
		}
		if (file.size > MAX_COVER_BYTES) {
			throw new UnprocessableEntityException({
				code: "MEDIA_TOO_LARGE",
				message: "Cover must be 5 MB or smaller.",
			});
		}
		const key = `blog/${id}/cover-${randomBytes(4).toString("hex")}.${ext}`;
		await this.storage.putObject(key, file.buffer, file.mimetype);
		if (post.coverKey && post.coverKey !== key) {
			await this.storage.deleteObject(post.coverKey).catch(() => {});
		}
		await this.prisma.blogPost.update({
			where: { id },
			data: { coverKey: key },
		});
		return {
			coverKey: key,
			coverUrl: await this.storage.getSignedDownloadUrl(key),
		};
	}

	/** Publish gate: a post needs a body. Sets `publishedAt` once. */
	async publishPost(id: string) {
		const post = await this.prisma.blogPost.findUnique({
			where: { id },
			select: { bodyHtml: true, publishedAt: true },
		});
		if (!post) throw new NotFoundException("Post not found");
		if (!post.bodyHtml || post.bodyHtml.replace(/<[^>]*>/g, "").trim() === "") {
			throw new UnprocessableEntityException({
				code: "POST_NOT_PUBLISHABLE",
				message: "Write the post body before publishing.",
			});
		}
		const updated = await this.prisma.blogPost.update({
			where: { id },
			data: {
				status: "published",
				publishedAt: post.publishedAt ?? new Date(),
			},
		});
		return this.withCover(updated);
	}
}
