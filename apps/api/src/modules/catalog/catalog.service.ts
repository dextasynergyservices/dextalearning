import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";

/** Commercial fields surfaced to the public catalogue (§4.1, §4.11). */
const COMMERCIAL_SELECT = {
	price: true,
	isFree: true,
	currency: true,
	isEarnBackEligible: true,
	earnBackPercentage: true,
	thumbnailKey: true,
} as const;

interface Commercial {
	price: unknown;
	thumbnailKey: string | null;
}

/**
 * Public read model for published content (§4) — what learners browse. Only
 * `published` courses are exposed; draft/archived stay invisible. No auth: this
 * is the public catalogue (playback itself is gated by `media-token`).
 */
@Injectable()
export class CatalogService {
	constructor(
		private readonly prisma: PrismaService,
		@Inject(STORAGE_PORT) private readonly storage: StoragePort,
	) {}

	/** Decimal `price` → number, plus a presigned thumbnail URL for the card. */
	private async withCommercials<T extends Commercial>(course: T) {
		return {
			...course,
			price: course.price == null ? null : Number(course.price),
			thumbnailUrl: course.thumbnailKey
				? await this.storage.getSignedDownloadUrl(course.thumbnailKey)
				: null,
		};
	}

	async listPublishedCourses() {
		const courses = await this.prisma.course.findMany({
			where: { status: "published" },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				title: true,
				slug: true,
				description: true,
				level: true,
				language: true,
				...COMMERCIAL_SELECT,
				_count: { select: { modules: true } },
			},
		});
		return Promise.all(courses.map((course) => this.withCommercials(course)));
	}

	async getPublishedCourse(slug: string) {
		const course = await this.prisma.course.findUnique({
			where: { slug },
			select: {
				id: true,
				title: true,
				slug: true,
				description: true,
				level: true,
				language: true,
				status: true,
				...COMMERCIAL_SELECT,
				earnBackDeadlineDays: true,
				modules: {
					orderBy: { orderIndex: "asc" },
					select: {
						id: true,
						title: true,
						orderIndex: true,
						lessons: {
							orderBy: { orderIndex: "asc" },
							select: {
								id: true,
								title: true,
								contentType: true,
								orderIndex: true,
								videoDurationSec: true,
								audioDurationSec: true,
							},
						},
					},
				},
			},
		});
		if (course?.status !== "published") {
			throw new NotFoundException("Course not found");
		}
		return this.withCommercials(course);
	}

	private async withPathCommercials<
		T extends Commercial & { estimatedHours?: unknown },
	>(path: T) {
		const base = await this.withCommercials(path);
		return {
			...base,
			estimatedHours:
				path.estimatedHours == null ? null : Number(path.estimatedHours),
		};
	}

	async listPublishedPaths() {
		const paths = await this.prisma.learningPath.findMany({
			where: { status: "published" },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				title: true,
				slug: true,
				description: true,
				level: true,
				outcomeStatement: true,
				estimatedHours: true,
				...COMMERCIAL_SELECT,
				_count: { select: { pathCourses: true } },
			},
		});
		return Promise.all(paths.map((path) => this.withPathCommercials(path)));
	}

	async getPublishedPath(slug: string) {
		const path = await this.prisma.learningPath.findUnique({
			where: { slug },
			select: {
				id: true,
				title: true,
				slug: true,
				description: true,
				level: true,
				outcomeStatement: true,
				estimatedHours: true,
				status: true,
				earnBackDeadlineDays: true,
				...COMMERCIAL_SELECT,
				pathCourses: {
					orderBy: { orderIndex: "asc" },
					select: {
						orderIndex: true,
						isRequired: true,
						course: {
							select: {
								id: true,
								title: true,
								slug: true,
								description: true,
								level: true,
								_count: { select: { modules: true } },
							},
						},
					},
				},
			},
		});
		if (path?.status !== "published") {
			throw new NotFoundException("Path not found");
		}
		return this.withPathCommercials(path);
	}

	private withCohortPrice<T extends { price?: unknown }>(cohort: T) {
		return {
			...cohort,
			price: cohort.price == null ? null : Number(cohort.price),
		};
	}

	async listPublishedCohorts() {
		const cohorts = await this.prisma.cohort.findMany({
			where: { status: "open" },
			orderBy: { startsAt: "asc" },
			select: {
				id: true,
				title: true,
				slug: true,
				description: true,
				startsAt: true,
				endsAt: true,
				capacity: true,
				seatsFilled: true,
				price: true,
				isFree: true,
				currency: true,
				isEarnBackEligible: true,
				earnBackPercentage: true,
				_count: { select: { courses: true } },
			},
		});
		return cohorts.map((cohort) => this.withCohortPrice(cohort));
	}

	async getPublishedCohort(slug: string) {
		const cohort = await this.prisma.cohort.findUnique({
			where: { slug },
			select: {
				id: true,
				title: true,
				slug: true,
				description: true,
				status: true,
				startsAt: true,
				endsAt: true,
				capacity: true,
				seatsFilled: true,
				examMode: true,
				price: true,
				isFree: true,
				currency: true,
				isEarnBackEligible: true,
				earnBackPercentage: true,
				courses: {
					orderBy: { orderIndex: "asc" },
					select: {
						orderIndex: true,
						course: {
							select: {
								id: true,
								title: true,
								slug: true,
								description: true,
								level: true,
								_count: { select: { modules: true } },
							},
						},
					},
				},
				instructors: {
					select: { user: { select: { id: true, name: true } } },
				},
			},
		});
		if (cohort?.status !== "open") {
			throw new NotFoundException("Cohort not found");
		}
		return this.withCohortPrice(cohort);
	}

	private async withCover<T extends { coverKey: string | null }>(post: T) {
		return {
			...post,
			coverUrl: post.coverKey
				? await this.storage.getSignedDownloadUrl(post.coverKey)
				: null,
		};
	}

	async listPublishedPosts() {
		const posts = await this.prisma.blogPost.findMany({
			where: { status: "published" },
			orderBy: { publishedAt: "desc" },
			select: {
				id: true,
				title: true,
				slug: true,
				excerpt: true,
				category: true,
				authorName: true,
				readMinutes: true,
				publishedAt: true,
				coverKey: true,
			},
		});
		return Promise.all(posts.map((post) => this.withCover(post)));
	}

	async getPublishedPost(slug: string) {
		const post = await this.prisma.blogPost.findUnique({
			where: { slug },
			select: {
				id: true,
				title: true,
				slug: true,
				excerpt: true,
				category: true,
				authorName: true,
				readMinutes: true,
				publishedAt: true,
				coverKey: true,
				bodyHtml: true,
				status: true,
			},
		});
		if (post?.status !== "published") {
			throw new NotFoundException("Post not found");
		}
		return this.withCover(post);
	}
}
