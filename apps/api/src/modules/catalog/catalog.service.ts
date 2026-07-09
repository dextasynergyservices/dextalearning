import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
	STORAGE_PORT,
	type StoragePort,
} from "../../shared/storage/storage.port";
import { rotateWindow, topByScore } from "./catalog.calculator";

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

/** How many candidates to score before keeping the top FEATURED_CAP. */
const RECO_POOL = 60;

const COURSE_CARD_SELECT = {
	id: true,
	title: true,
	slug: true,
	description: true,
	level: true,
	language: true,
	enrolledCount: true,
	...COMMERCIAL_SELECT,
	_count: { select: { modules: true } },
} as const;

const PATH_CARD_SELECT = {
	id: true,
	title: true,
	slug: true,
	description: true,
	level: true,
	outcomeStatement: true,
	estimatedHours: true,
	estimatedDuration: true,
	...COMMERCIAL_SELECT,
	_count: { select: { pathCourses: true } },
} as const;

const COHORT_CARD_SELECT = {
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
} as const;

/** Public instructor fields surfaced on course/instructor pages (§8.1.1). */
const INSTRUCTOR_SELECT = {
	id: true,
	firstName: true,
	lastName: true,
	fullName: true,
	image: true,
	avatarUrl: true,
	headline: true,
	bio: true,
	expertiseAreas: true,
} as const;

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

	/** Shape the raw creator row into the public instructor profile (§8.1.1). */
	private async shapeInstructor(
		creator: {
			id: string;
			firstName: string;
			lastName: string;
			fullName: string | null;
			image: string | null;
			avatarUrl: string | null;
			headline: string | null;
			bio: string | null;
			expertiseAreas: string[];
		} | null,
	) {
		if (!creator) return null;
		// Prefer an uploaded avatar (avatarUrl key) over the Better Auth `image`
		// (e.g. a Google photo); presign keys, pass external URLs through.
		const avatarKey = creator.avatarUrl ?? creator.image;
		return {
			id: creator.id,
			name:
				creator.fullName?.trim() ||
				`${creator.firstName} ${creator.lastName}`.trim(),
			image:
				avatarKey && /^https?:\/\//.test(avatarKey)
					? avatarKey
					: avatarKey
						? await this.storage.getSignedDownloadUrl(avatarKey)
						: null,
			headline: creator.headline,
			bio: creator.bio,
			expertiseAreas: creator.expertiseAreas,
		};
	}

	/**
	 * Homepage "Featured" shelves — admin-approved (`isFeatured`) courses/paths
	 * (published) and cohorts (open), card-shaped, on a weekly rotation.
	 */
	async getFeatured() {
		const [courses, paths, cohorts] = await Promise.all([
			this.prisma.course.findMany({
				where: { status: "published", isFeatured: true },
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
			}),
			this.prisma.learningPath.findMany({
				where: { status: "published", isFeatured: true },
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					title: true,
					slug: true,
					description: true,
					level: true,
					outcomeStatement: true,
					estimatedHours: true,
					estimatedDuration: true,
					...COMMERCIAL_SELECT,
					_count: { select: { pathCourses: true } },
				},
			}),
			this.prisma.cohort.findMany({
				where: { status: "open", isFeatured: true },
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
			}),
		]);
		return {
			courses: await Promise.all(
				rotateWindow(courses).map((c) => this.withCommercials(c)),
			),
			paths: await Promise.all(
				rotateWindow(paths).map((p) => this.withPathCommercials(p)),
			),
			cohorts: rotateWindow(cohorts).map((c) => this.withCohortPrice(c)),
		};
	}

	/**
	 * "Recommended" shelves. Each of the three shelves (courses, paths, cohorts)
	 * is independently a hybrid recommender — a **collaborative** signal
	 * ("learners who enrolled in your X also enrolled in…", via co-enrolment by
	 * peers) blended with **content** signals (matching level/language where the
	 * entity has them). Items already enrolled in, and anything `isFeatured`, are
	 * excluded (so Featured/Recommended never duplicate). Candidates are fetched
	 * in popularity order and the sort is stable, so a logged-out / cold-start
	 * learner (no signal) naturally falls back to popularity. `personalized` is
	 * reported **per shelf**, since a learner may have history in one type but not
	 * another — only a truly personalised shelf shows the "because…" note.
	 */
	async getRecommended(userId?: string) {
		const [courseEnr, pathEnr, cohortEnr, profile] = userId
			? await Promise.all([
					this.prisma.courseEnrollment.findMany({
						where: { userId },
						select: { courseId: true },
					}),
					this.prisma.pathEnrollment.findMany({
						where: { userId },
						select: { pathId: true },
					}),
					this.prisma.cohortEnrollment.findMany({
						where: { userId },
						select: { cohortId: true },
					}),
					// Onboarding signal — biases cold-start (pre-enrolment) picks by level.
					this.prisma.user.findUnique({
						where: { id: userId },
						select: { skillLevel: true },
					}),
				])
			: [[], [], [], null];

		const [courses, paths, cohorts] = await Promise.all([
			this.recommendedCourses(
				userId,
				courseEnr.map((e) => e.courseId),
				profile?.skillLevel ?? null,
			),
			this.recommendedPaths(
				userId,
				pathEnr.map((e) => e.pathId),
			),
			this.recommendedCohorts(
				userId,
				cohortEnr.map((e) => e.cohortId),
			),
		]);
		return {
			courses: courses.items,
			paths: paths.items,
			cohorts: cohorts.items,
			personalized: {
				courses: courses.personalized,
				paths: paths.personalized,
				cohorts: cohorts.personalized,
			},
		};
	}

	/**
	 * Item-based co-enrolment counts for the collaborative signal: how many peers
	 * (learners who share at least one of `enrolledIds`) enrolled in each *other*
	 * item. `model` is one of the three enrolment delegates; `idField` its FK.
	 */
	private async coEnrolment<F extends "courseId" | "pathId" | "cohortId">(
		model: {
			findMany: (args: unknown) => Promise<Array<{ userId: string }>>;
			groupBy: (args: unknown) => Promise<Array<Record<string, unknown>>>;
		},
		idField: F,
		userId: string,
		enrolledIds: string[],
	): Promise<Map<string, number>> {
		const peers = await model.findMany({
			where: { [idField]: { in: enrolledIds }, userId: { not: userId } },
			select: { userId: true },
			distinct: ["userId"],
		});
		const peerIds = peers.map((p) => p.userId);
		if (peerIds.length === 0) return new Map();
		const grouped = await model.groupBy({
			by: [idField],
			where: { userId: { in: peerIds }, [idField]: { notIn: enrolledIds } },
			_count: { [idField]: true },
		});
		return new Map(
			grouped.map((g) => [
				g[idField] as string,
				(g._count as Record<string, number>)[idField],
			]),
		);
	}

	/** Course shelf — CF + level/language content match, popularity fallback. */
	private async recommendedCourses(
		userId: string | undefined,
		enrolledIds: string[],
		onboardingLevel?: string | null,
	) {
		const personalized = Boolean(userId) && enrolledIds.length > 0;
		const candidates = await this.prisma.course.findMany({
			where: {
				status: "published",
				isFeatured: false,
				id: { notIn: enrolledIds },
			},
			orderBy: [{ enrolledCount: "desc" }, { createdAt: "desc" }],
			take: RECO_POOL,
			select: COURSE_CARD_SELECT,
		});

		let coMap = new Map<string, number>();
		let levels = new Set<string>();
		let languages = new Set<string>();
		if (personalized && userId) {
			const enrolled = await this.prisma.course.findMany({
				where: { id: { in: enrolledIds } },
				select: { level: true, language: true },
			});
			levels = new Set(
				enrolled.map((c) => c.level).filter(Boolean) as string[],
			);
			languages = new Set(
				enrolled.map((c) => c.language).filter(Boolean) as string[],
			);
			coMap = await this.coEnrolment(
				this.prisma.courseEnrollment,
				"courseId",
				userId,
				enrolledIds,
			);
		}
		// Onboarding level biases ranking even before any enrolment (cold start) —
		// without claiming the collaborative "because…" note (`personalized` stays
		// false unless there's real co-enrolment history).
		if (onboardingLevel) levels.add(onboardingLevel);

		const top = topByScore(candidates, (c) => ({
			co: coMap.get(c.id) ?? 0,
			content:
				(c.level && levels.has(c.level) ? 1.5 : 0) +
				(c.language && languages.has(c.language) ? 1 : 0),
		}));
		return {
			items: await Promise.all(top.map((c) => this.withCommercials(c))),
			personalized,
		};
	}

	/** Path shelf — CF + level content match, popularity fallback. */
	private async recommendedPaths(
		userId: string | undefined,
		enrolledIds: string[],
	) {
		const personalized = Boolean(userId) && enrolledIds.length > 0;
		const candidates = await this.prisma.learningPath.findMany({
			where: {
				status: "published",
				isFeatured: false,
				id: { notIn: enrolledIds },
			},
			orderBy: [{ enrollments: { _count: "desc" } }, { createdAt: "desc" }],
			take: RECO_POOL,
			select: PATH_CARD_SELECT,
		});

		let coMap = new Map<string, number>();
		let levels = new Set<string>();
		if (personalized && userId) {
			const enrolled = await this.prisma.learningPath.findMany({
				where: { id: { in: enrolledIds } },
				select: { level: true },
			});
			levels = new Set(
				enrolled.map((p) => p.level).filter(Boolean) as string[],
			);
			coMap = await this.coEnrolment(
				this.prisma.pathEnrollment,
				"pathId",
				userId,
				enrolledIds,
			);
		}

		const top = topByScore(candidates, (p) => ({
			co: coMap.get(p.id) ?? 0,
			content: p.level && levels.has(p.level) ? 1.5 : 0,
		}));
		return {
			items: await Promise.all(top.map((p) => this.withPathCommercials(p))),
			personalized,
		};
	}

	/** Cohort shelf — CF only (cohorts carry no level/language), popularity fallback. */
	private async recommendedCohorts(
		userId: string | undefined,
		enrolledIds: string[],
	) {
		const personalized = Boolean(userId) && enrolledIds.length > 0;
		const candidates = await this.prisma.cohort.findMany({
			where: { status: "open", isFeatured: false, id: { notIn: enrolledIds } },
			orderBy: [{ seatsFilled: "desc" }, { startsAt: "asc" }],
			take: RECO_POOL,
			select: COHORT_CARD_SELECT,
		});

		let coMap = new Map<string, number>();
		if (personalized && userId) {
			coMap = await this.coEnrolment(
				this.prisma.cohortEnrollment,
				"cohortId",
				userId,
				enrolledIds,
			);
		}

		const top = topByScore(candidates, (c) => ({
			co: coMap.get(c.id) ?? 0,
			content: 0,
		}));
		return { items: top.map((c) => this.withCohortPrice(c)), personalized };
	}

	/** Pending instructor "feature me" requests for an admin to approve (§4.1). */
	async getFeatureRequests() {
		const [courses, paths] = await Promise.all([
			this.prisma.course.findMany({
				where: { featureRequested: true, status: "published" },
				orderBy: { createdAt: "desc" },
				select: { id: true, title: true, slug: true, isFeatured: true },
			}),
			this.prisma.learningPath.findMany({
				where: { featureRequested: true, status: "published" },
				orderBy: { createdAt: "desc" },
				select: { id: true, title: true, slug: true, isFeatured: true },
			}),
		]);
		return [
			...courses.map((c) => ({ type: "course" as const, ...c })),
			...paths.map((p) => ({ type: "path" as const, ...p })),
		];
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
				enrolledCount: true,
				...COMMERCIAL_SELECT,
				_count: { select: { modules: true } },
				modules: {
					select: {
						lessons: { where: { isPreview: true }, select: { id: true } },
					},
				},
			},
		});
		return Promise.all(
			courses.map(async ({ modules, ...course }) => ({
				...(await this.withCommercials(course)),
				// First free-preview lesson, so cards can offer "Watch preview".
				previewLessonId: modules.flatMap((m) => m.lessons)[0]?.id ?? null,
			})),
		);
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
				estimatedDuration: true,
				enrolledCount: true,
				...COMMERCIAL_SELECT,
				earnBackDeadlineDays: true,
				creator: { select: INSTRUCTOR_SELECT },
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
								isPreview: true,
							},
						},
					},
				},
			},
		});
		if (course?.status !== "published") {
			throw new NotFoundException("Course not found");
		}
		const { creator, ...rest } = course;
		return {
			...(await this.withCommercials(rest)),
			instructor: await this.shapeInstructor(creator),
		};
	}

	/** Public instructor profile + their published courses (§8.1.1). */
	async getPublishedInstructor(id: string) {
		const user = await this.prisma.user.findUnique({
			where: { id },
			select: {
				...INSTRUCTOR_SELECT,
				role: true,
				createdCourses: {
					where: { status: "published" },
					orderBy: { createdAt: "desc" },
					select: COURSE_CARD_SELECT,
				},
				createdLearningPaths: {
					where: { status: "published" },
					orderBy: { createdAt: "desc" },
					select: PATH_CARD_SELECT,
				},
				createdCohorts: {
					where: { status: "open" },
					orderBy: { startsAt: "asc" },
					select: COHORT_CARD_SELECT,
				},
			},
		});
		if (!user || (user.role !== "instructor" && user.role !== "admin")) {
			throw new NotFoundException("Instructor not found");
		}
		const { createdCourses, createdLearningPaths, createdCohorts, ...profile } =
			user;
		return {
			instructor: await this.shapeInstructor(profile),
			courses: await Promise.all(
				createdCourses.map((c) => this.withCommercials(c)),
			),
			paths: await Promise.all(
				createdLearningPaths.map((p) => this.withPathCommercials(p)),
			),
			cohorts: createdCohorts.map((c) => this.withCohortPrice(c)),
		};
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
				estimatedDuration: true,
				...COMMERCIAL_SELECT,
				introLesson: { select: { id: true, contentType: true } },
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
				estimatedDuration: true,
				status: true,
				earnBackDeadlineDays: true,
				...COMMERCIAL_SELECT,
				creator: { select: INSTRUCTOR_SELECT },
				introLesson: { select: { id: true, contentType: true } },
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
								modules: {
									select: {
										lessons: {
											select: {
												videoDurationSec: true,
												audioDurationSec: true,
											},
										},
									},
								},
							},
						},
					},
				},
			},
		});
		if (path?.status !== "published") {
			throw new NotFoundException("Path not found");
		}
		// Fold each course's lesson media into a calculated content length (§4.3),
		// dropping the raw lesson rows from the payload.
		const pathCourses = path.pathCourses.map((pc) => {
			const seconds = pc.course.modules.reduce(
				(sum, m) =>
					sum +
					m.lessons.reduce(
						(s, l) => s + (l.videoDurationSec ?? l.audioDurationSec ?? 0),
						0,
					),
				0,
			);
			const { modules: _modules, ...course } = pc.course;
			return {
				...pc,
				course: {
					...course,
					contentMinutes: seconds > 0 ? Math.ceil(seconds / 60) : 0,
				},
			};
		});
		const { creator, ...pathRest } = path;
		return {
			...(await this.withPathCommercials({ ...pathRest, pathCourses })),
			instructor: await this.shapeInstructor(creator),
		};
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
				introLesson: { select: { id: true, contentType: true } },
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
				creator: { select: INSTRUCTOR_SELECT },
				introLesson: { select: { id: true, contentType: true } },
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
		const { creator, ...cohortRest } = cohort;
		return {
			...this.withCohortPrice(cohortRest),
			instructor: await this.shapeInstructor(creator),
		};
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
