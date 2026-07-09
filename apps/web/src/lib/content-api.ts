import { apiFetch } from "./api";
import type { TranscriptCue } from "./transcript";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

// ── Playback (media-token, §12.6) ──────────────────────────────────────────
export interface MediaToken {
	type: "video" | "audio" | "pdf" | "text";
	qualities?: Record<string, string>;
	defaultQuality?: string;
	audioUrl?: string | null;
	pages?: string[];
	contentText?: string | null;
	captionUrls?: Record<string, string | null>;
	transcriptText?: string | null;
	/** Timed segments for the in-player synced highlight (video/audio only). */
	transcriptCues?: TranscriptCue[] | null;
	duration?: number | null;
}

export function getMediaToken(lessonId: string): Promise<MediaToken> {
	return apiFetch<MediaToken>(`/lessons/${lessonId}/media-token`);
}

/** Public playback for a free-preview lesson (no auth — §2.4). */
export function getPreviewMediaToken(lessonId: string): Promise<MediaToken> {
	return apiFetch<MediaToken>(`/lessons/${lessonId}/preview-media-token`);
}

/** Public playback for a path/cohort intro lesson (no auth). */
export function getIntroMediaToken(lessonId: string): Promise<MediaToken> {
	return apiFetch<MediaToken>(`/lessons/${lessonId}/intro-media-token`);
}

// ── Commercial fields (pricing + Earn-Back, §4.11) ──────────────────────────
export const CURRENCY_SYMBOL: Record<string, string> = {
	NGN: "₦",
	USD: "$",
	GHS: "₵",
	KES: "KSh",
	ZAR: "R",
	GBP: "£",
	EUR: "€",
};

export function formatMoney(currency: string, amount: number): string {
	return `${CURRENCY_SYMBOL[currency] ?? ""}${amount.toLocaleString(undefined, {
		maximumFractionDigits: 2,
	})}`;
}

export interface Commercials {
	thumbnailUrl: string | null;
	price: number | null;
	isFree: boolean;
	currency: string;
	isEarnBackEligible: boolean;
	earnBackPercentage: number | null;
}

// ── Public catalogue (published content) ────────────────────────────────────
export interface PublishedCourse extends Commercials {
	id: string;
	title: string;
	slug: string;
	description: string | null;
	level: string | null;
	language: string;
	thumbnailKey: string | null;
	previewLessonId?: string | null;
	/** Denormalized social-proof counter (§3.2 "N enrolled"). */
	enrolledCount: number;
	_count: { modules: number };
}

export interface PublicLesson {
	id: string;
	title: string;
	contentType: "video" | "text" | "pdf" | "audio" | null;
	orderIndex: number;
	videoDurationSec: number | null;
	audioDurationSec: number | null;
	isPreview: boolean;
}

/** Public instructor profile surfaced on course + instructor pages (§8.1.1). */
export interface InstructorPublic {
	id: string;
	name: string;
	image: string | null;
	headline: string | null;
	bio: string | null;
	expertiseAreas: string[];
}

export interface PublicCourse extends Commercials {
	id: string;
	title: string;
	slug: string;
	description: string | null;
	level: string | null;
	language: string;
	estimatedDuration: string | null;
	earnBackDeadlineDays: number | null;
	/** Denormalized social-proof counter (§3.2 "N enrolled"). */
	enrolledCount: number;
	instructor?: InstructorPublic | null;
	modules: {
		id: string;
		title: string;
		orderIndex: number;
		lessons: PublicLesson[];
	}[];
}

export interface InstructorProfile {
	instructor: InstructorPublic;
	courses: PublishedCourse[];
	paths: PublishedPath[];
	cohorts: PublishedCohort[];
}

export const getInstructor = (id: string) =>
	apiFetch<InstructorProfile>(`/catalog/instructors/${id}`);

export const getPublishedCourses = () =>
	apiFetch<PublishedCourse[]>("/catalog/courses");

export interface FeaturedCatalog {
	courses: PublishedCourse[];
	paths: PublishedPath[];
	cohorts: PublishedCohort[];
	/** Recommended only: which shelves are personalised to the signed-in learner. */
	personalized?: { courses: boolean; paths: boolean; cohorts: boolean };
}

export const getFeatured = () => apiFetch<FeaturedCatalog>("/catalog/featured");

export const getRecommended = () =>
	apiFetch<FeaturedCatalog>("/catalog/recommended");

export interface FeatureRequestItem {
	type: "course" | "path";
	id: string;
	title: string;
	slug: string;
	isFeatured: boolean;
}

export const getFeatureRequests = () =>
	apiFetch<FeatureRequestItem[]>("/catalog/feature-requests");

export const getPublicCourse = (slug: string) =>
	apiFetch<PublicCourse>(`/catalog/courses/${slug}`);

// ── Authoring (courses → modules → lessons) ─────────────────────────────────
export interface CourseSummary extends Commercials {
	id: string;
	title: string;
	slug: string;
	status: "draft" | "published" | "archived" | null;
	level: string | null;
	thumbnailKey: string | null;
	createdAt: string;
	_count: { modules: number };
}

export interface LessonNode {
	id: string;
	title: string;
	contentType: "video" | "text" | "pdf" | "audio" | null;
	orderIndex: number;
	introForPathId?: string | null;
	introForCohortId?: string | null;
	transcriptText: string | null;
	transcriptCuesJson: TranscriptCue[] | null;
	videoKeysJson: unknown;
	videoDurationSec: number | null;
	videoThumbnailKey: string | null;
	audioKey: string | null;
	audioDurationSec: number | null;
	audioSizeBytes: number | null;
	pdfKey: string | null;
	contentText: string | null;
	minVideoWatchPct?: number | string | null;
	hasPreQuiz?: boolean;
	hasPostQuiz?: boolean;
	postQuizPassMark?: number | string | null;
	isPreview?: boolean;
}

export interface ModuleNode {
	id: string;
	title: string;
	orderIndex: number;
	lessons: LessonNode[];
}

export interface CourseDetail extends CourseSummary {
	description: string | null;
	language: string;
	estimatedDuration: string | null;
	hasFinalAssessment: boolean;
	isFeatured: boolean;
	featureRequested: boolean;
	earnBackDeadlineDays: number | null;
	modules: ModuleNode[];
}

export const listMyCourses = () => apiFetch<CourseSummary[]>("/courses/mine");

export const createCourse = (body: {
	title: string;
	description?: string;
	level?: string;
}) =>
	apiFetch<CourseSummary>("/courses", {
		method: "POST",
		body: JSON.stringify(body),
	});

export const getCourse = (id: string) =>
	apiFetch<CourseDetail>(`/courses/${id}`);

export const publishCourse = (id: string) =>
	apiFetch<CourseSummary>(`/courses/${id}/publish`, { method: "POST" });

export interface CourseSettingsInput {
	title?: string;
	description?: string;
	level?: string;
	language?: string;
	estimatedDuration?: string;
	hasFinalAssessment?: boolean;
	isFeatured?: boolean;
	featureRequested?: boolean;
	price?: number;
	isFree?: boolean;
	currency?: string;
	isEarnBackEligible?: boolean;
	earnBackPercentage?: number;
	earnBackDeadlineDays?: number;
}

export const updateCourse = (id: string, body: CourseSettingsInput) =>
	apiFetch<CourseDetail>(`/courses/${id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});

export const deleteCourse = (id: string) =>
	apiFetch(`/courses/${id}`, { method: "DELETE" });

export const createModule = (courseId: string, title: string) =>
	apiFetch<ModuleNode>(`/courses/${courseId}/modules`, {
		method: "POST",
		body: JSON.stringify({ title }),
	});

export const deleteModule = (id: string) =>
	apiFetch(`/modules/${id}`, { method: "DELETE" });

export const createLesson = (
	moduleId: string,
	body: { title: string; contentType?: string },
) =>
	apiFetch<LessonNode>(`/modules/${moduleId}/lessons`, {
		method: "POST",
		body: JSON.stringify(body),
	});

export const getLessonForEdit = (id: string) =>
	apiFetch<
		LessonNode & { captions: { languageCode: string; vttKey: string }[] }
	>(`/lessons/${id}/edit`);

export const updateLesson = (id: string, body: Record<string, unknown>) =>
	apiFetch<LessonNode>(`/lessons/${id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});

export const deleteLesson = (id: string) =>
	apiFetch(`/lessons/${id}`, { method: "DELETE" });

export const reorderLessons = (moduleId: string, lessonIds: string[]) =>
	apiFetch(`/modules/${moduleId}/lessons/reorder`, {
		method: "PATCH",
		body: JSON.stringify({ lessonIds }),
	});

export const updateTranscript = (
	lessonId: string,
	text: string,
	cues?: TranscriptCue[],
) =>
	apiFetch(`/lessons/${lessonId}/transcript`, {
		method: "PATCH",
		body: JSON.stringify(cues && cues.length > 0 ? { text, cues } : { text }),
	});

export interface MediaJobStatus {
	kind: "video" | "audio" | "caption";
	state:
		| "active"
		| "waiting"
		| "delayed"
		| "prioritized"
		| "completed"
		| "failed"
		| "not_found"
		| string;
	progress: number;
	jobId: string | null;
	failedReason: string | null;
	processedOn?: number | null;
	finishedOn?: number | null;
}

export const getMediaJobStatus = (
	lessonId: string,
	kind: "video" | "audio" | "caption",
) => apiFetch<MediaJobStatus>(`/lessons/${lessonId}/media-status?kind=${kind}`);

// ── Multipart uploads with progress (XHR — fetch has no upload progress) ─────
export function uploadFile<T = unknown>(
	path: string,
	file: File,
	onProgress?: (pct: number) => void,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const form = new FormData();
		form.append("file", file);
		const xhr = new XMLHttpRequest();
		xhr.open("POST", `${API_URL}${path}`);
		xhr.withCredentials = true;
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable && onProgress) {
				onProgress(Math.round((event.loaded / event.total) * 100));
			}
		};
		xhr.onload = () => {
			const body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
			if (xhr.status >= 200 && xhr.status < 300 && body?.success) {
				resolve(body.data as T);
			} else {
				reject(new Error(body?.error?.message ?? "Upload failed"));
			}
		};
		xhr.onerror = () => reject(new Error("Network error during upload"));
		xhr.send(form);
	});
}

export const uploadVideo = (
	lessonId: string,
	file: File,
	onProgress?: (p: number) => void,
) => uploadFile(`/lessons/${lessonId}/video`, file, onProgress);

export const uploadAudio = (
	lessonId: string,
	file: File,
	onProgress?: (p: number) => void,
) => uploadFile(`/lessons/${lessonId}/audio`, file, onProgress);

export const uploadPdf = (
	lessonId: string,
	file: File,
	onProgress?: (p: number) => void,
) => uploadFile(`/lessons/${lessonId}/pdf`, file, onProgress);

export const uploadCaption = (lessonId: string, language: string, file: File) =>
	uploadFile(`/lessons/${lessonId}/captions/${language}`, file);

export const uploadCourseThumbnail = (
	courseId: string,
	file: File,
	onProgress?: (p: number) => void,
) =>
	uploadFile<{ thumbnailKey: string; thumbnailUrl: string }>(
		`/courses/${courseId}/thumbnail`,
		file,
		onProgress,
	);

export const removeMedia = (
	lessonId: string,
	kind: "video" | "audio" | "pdf",
) => apiFetch(`/lessons/${lessonId}/${kind}`, { method: "DELETE" });

export const removeCaption = (lessonId: string, language: string) =>
	apiFetch(`/lessons/${lessonId}/captions/${language}`, { method: "DELETE" });

// ── Learning Paths (§4.1) ───────────────────────────────────────────────────
export interface PathSummary extends Commercials {
	id: string;
	title: string;
	slug: string;
	status: "draft" | "published" | "archived" | null;
	level: string | null;
	thumbnailKey: string | null;
	estimatedHours: number | null;
	createdAt: string;
	_count: { pathCourses: number };
}

export interface PathCourseRef {
	id: string;
	title: string;
	slug?: string;
	status: "draft" | "published" | "archived" | null;
	level: string | null;
	description?: string | null;
	contentMinutes?: number;
	_count?: { modules: number };
}

export interface PathCourseNode {
	orderIndex: number;
	isRequired: boolean;
	course: PathCourseRef;
}

/** A path/cohort intro/preview lesson. In the builder it carries the media
 *  fields (to show ready vs empty); publicly only id + contentType. */
export interface IntroLesson {
	id: string;
	contentType: "video" | "text" | "pdf" | "audio" | null;
	videoKeysJson?: unknown;
	audioKey?: string | null;
	pdfKey?: string | null;
	contentText?: string | null;
}

export interface PathDetail extends PathSummary {
	description: string | null;
	outcomeStatement: string | null;
	estimatedDuration: string | null;
	earnBackDeadlineDays: number | null;
	isFeatured: boolean;
	featureRequested: boolean;
	introLesson: IntroLesson | null;
	pathCourses: PathCourseNode[];
	availableCourses: PathCourseRef[];
}

export interface PublishedPath extends Commercials {
	id: string;
	title: string;
	slug: string;
	description: string | null;
	level: string | null;
	outcomeStatement: string | null;
	estimatedHours: number | null;
	estimatedDuration: string | null;
	introLesson?: { id: string; contentType: string | null } | null;
	_count: { pathCourses: number };
}

export interface PublicPath extends Commercials {
	id: string;
	title: string;
	slug: string;
	description: string | null;
	level: string | null;
	outcomeStatement: string | null;
	estimatedHours: number | null;
	estimatedDuration: string | null;
	earnBackDeadlineDays: number | null;
	introLesson: { id: string; contentType: string | null } | null;
	instructor?: InstructorPublic | null;
	pathCourses: PathCourseNode[];
}

export interface PathSettingsInput {
	title?: string;
	description?: string;
	level?: string;
	outcomeStatement?: string;
	estimatedHours?: number;
	estimatedDuration?: string;
	isFeatured?: boolean;
	featureRequested?: boolean;
	price?: number;
	isFree?: boolean;
	currency?: string;
	isEarnBackEligible?: boolean;
	earnBackPercentage?: number;
	earnBackDeadlineDays?: number;
}

export const listMyPaths = () => apiFetch<PathSummary[]>("/paths/mine");

export const createPath = (body: {
	title: string;
	description?: string;
	level?: string;
}) =>
	apiFetch<PathSummary>("/paths", {
		method: "POST",
		body: JSON.stringify(body),
	});

export const getPath = (id: string) => apiFetch<PathDetail>(`/paths/${id}`);

export const updatePath = (id: string, body: PathSettingsInput) =>
	apiFetch<PathDetail>(`/paths/${id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});

export const deletePath = (id: string) =>
	apiFetch(`/paths/${id}`, { method: "DELETE" });

export const createPathIntro = (id: string) =>
	apiFetch<{ id: string }>(`/paths/${id}/intro`, { method: "POST" });

export const removePathIntro = (id: string) =>
	apiFetch(`/paths/${id}/intro`, { method: "DELETE" });

export const publishPath = (id: string) =>
	apiFetch<PathSummary>(`/paths/${id}/publish`, { method: "POST" });

export const addPathCourse = (
	id: string,
	courseId: string,
	isRequired = true,
) =>
	apiFetch(`/paths/${id}/courses`, {
		method: "POST",
		body: JSON.stringify({ courseId, isRequired }),
	});

export const removePathCourse = (id: string, courseId: string) =>
	apiFetch(`/paths/${id}/courses/${courseId}`, { method: "DELETE" });

export const reorderPathCourses = (id: string, courseIds: string[]) =>
	apiFetch(`/paths/${id}/courses/reorder`, {
		method: "PATCH",
		body: JSON.stringify({ courseIds }),
	});

export const uploadPathThumbnail = (
	id: string,
	file: File,
	onProgress?: (p: number) => void,
) =>
	uploadFile<{ thumbnailKey: string; thumbnailUrl: string }>(
		`/paths/${id}/thumbnail`,
		file,
		onProgress,
	);

export const getPublishedPaths = () =>
	apiFetch<PublishedPath[]>("/catalog/paths");

export const getPublicPath = (slug: string) =>
	apiFetch<PublicPath>(`/catalog/paths/${slug}`);

// ── Cohorts (Admin only — §4.1) ─────────────────────────────────────────────
export type CohortStatus = "draft" | "open" | "active" | "closed" | null;

export interface CohortSummary {
	id: string;
	title: string;
	slug: string;
	status: CohortStatus;
	startsAt: string | null;
	endsAt: string | null;
	capacity: number | null;
	seatsFilled: number;
	price: number | null;
	isFree: boolean;
	currency: string;
	isEarnBackEligible: boolean;
	earnBackPercentage: number | null;
	createdAt: string;
	_count: { courses: number };
}

export interface CohortStaff {
	id: string;
	name: string | null;
	email?: string | null;
	role?: string | null;
}

export interface CohortCourseNode {
	orderIndex: number | null;
	course: {
		id: string;
		title: string;
		slug?: string;
		status: "draft" | "published" | "archived" | null;
		level: string | null;
		description?: string | null;
		_count?: { modules: number };
	};
}

export interface CohortPathNode {
	pathId: string;
	orderIndex: number | null;
	path: {
		id: string;
		title: string;
		status: "draft" | "published" | "archived" | null;
		level: string | null;
	};
}

export interface CohortDetail extends CohortSummary {
	description: string | null;
	examMode: string | null;
	unlockMode: string | null;
	groupingMode: string;
	targetGroupSize: number;
	minGroupSize: number;
	maxGroupSize: number;
	isFeatured: boolean;
	introLesson: IntroLesson | null;
	courses: CohortCourseNode[];
	paths: CohortPathNode[];
	instructors: { user: CohortStaff }[];
	facilitators: { user: CohortStaff }[];
	availableCourses: CohortCourseNode["course"][];
	availablePaths: CohortPathNode["path"][];
	assignableInstructors: CohortStaff[];
	assignableFacilitators: CohortStaff[];
}

export interface PublishedCohort {
	id: string;
	title: string;
	slug: string;
	description: string | null;
	startsAt: string | null;
	endsAt: string | null;
	capacity: number | null;
	seatsFilled: number;
	price: number | null;
	isFree: boolean;
	currency: string;
	isEarnBackEligible: boolean;
	earnBackPercentage: number | null;
	introLesson?: { id: string; contentType: string | null } | null;
	_count: { courses: number };
}

export interface PublicCohort extends PublishedCohort {
	examMode: string | null;
	introLesson: { id: string; contentType: string | null } | null;
	courses: CohortCourseNode[];
	instructors: { user: { id: string; name: string | null } }[];
	/** The creator's public profile (byline). Distinct from assigned `instructors`. */
	instructor?: InstructorPublic | null;
}

export interface CohortSettingsInput {
	title?: string;
	description?: string;
	startsAt?: string;
	endsAt?: string;
	capacity?: number;
	price?: number;
	isFree?: boolean;
	currency?: string;
	isEarnBackEligible?: boolean;
	earnBackPercentage?: number;
	isFeatured?: boolean;
	examMode?: string;
	unlockMode?: string;
	groupingMode?: string;
	targetGroupSize?: number;
	minGroupSize?: number;
	maxGroupSize?: number;
}

export const listCohorts = () => apiFetch<CohortSummary[]>("/cohorts");

export const createCohort = (body: { title: string; description?: string }) =>
	apiFetch<CohortSummary>("/cohorts", {
		method: "POST",
		body: JSON.stringify(body),
	});

export const getCohort = (id: string) =>
	apiFetch<CohortDetail>(`/cohorts/${id}`);

export const updateCohort = (id: string, body: CohortSettingsInput) =>
	apiFetch<CohortDetail>(`/cohorts/${id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});

export const deleteCohort = (id: string) =>
	apiFetch(`/cohorts/${id}`, { method: "DELETE" });

export const createCohortIntro = (id: string) =>
	apiFetch<{ id: string }>(`/cohorts/${id}/intro`, { method: "POST" });

export const removeCohortIntro = (id: string) =>
	apiFetch(`/cohorts/${id}/intro`, { method: "DELETE" });

export const publishCohort = (id: string) =>
	apiFetch<CohortSummary>(`/cohorts/${id}/publish`, { method: "POST" });

export const addCohortCourse = (id: string, courseId: string) =>
	apiFetch(`/cohorts/${id}/courses`, {
		method: "POST",
		body: JSON.stringify({ courseId }),
	});

export const removeCohortCourse = (id: string, courseId: string) =>
	apiFetch(`/cohorts/${id}/courses/${courseId}`, { method: "DELETE" });

export const addCohortPath = (id: string, pathId: string) =>
	apiFetch(`/cohorts/${id}/paths`, {
		method: "POST",
		body: JSON.stringify({ pathId }),
	});

export const removeCohortPath = (id: string, pathId: string) =>
	apiFetch(`/cohorts/${id}/paths/${pathId}`, { method: "DELETE" });

export const reorderCohortCourses = (id: string, courseIds: string[]) =>
	apiFetch(`/cohorts/${id}/courses/reorder`, {
		method: "PATCH",
		body: JSON.stringify({ courseIds }),
	});

export const assignCohortInstructor = (id: string, userId: string) =>
	apiFetch(`/cohorts/${id}/instructors`, {
		method: "POST",
		body: JSON.stringify({ userId }),
	});

export const removeCohortInstructor = (id: string, userId: string) =>
	apiFetch(`/cohorts/${id}/instructors/${userId}`, { method: "DELETE" });

export const assignCohortFacilitator = (id: string, userId: string) =>
	apiFetch(`/cohorts/${id}/facilitators`, {
		method: "POST",
		body: JSON.stringify({ userId }),
	});

export const removeCohortFacilitator = (id: string, userId: string) =>
	apiFetch(`/cohorts/${id}/facilitators/${userId}`, { method: "DELETE" });

export const getPublishedCohorts = () =>
	apiFetch<PublishedCohort[]>("/catalog/cohorts");

export const getPublicCohort = (slug: string) =>
	apiFetch<PublicCohort>(`/catalog/cohorts/${slug}`);

// ── Blog (Admin only) ───────────────────────────────────────────────────────
export interface BlogPostSummary {
	id: string;
	title: string;
	slug: string;
	excerpt: string | null;
	category: string | null;
	status: "draft" | "published" | "archived" | null;
	authorName: string | null;
	readMinutes: number | null;
	publishedAt: string | null;
	createdAt: string;
}

export interface BlogPostDetail extends BlogPostSummary {
	coverKey: string | null;
	coverUrl: string | null;
	bodyHtml: string | null;
}

export interface PublishedPost {
	id: string;
	title: string;
	slug: string;
	excerpt: string | null;
	category: string | null;
	authorName: string | null;
	readMinutes: number | null;
	publishedAt: string | null;
	coverUrl: string | null;
}

export interface PublicPost extends PublishedPost {
	bodyHtml: string | null;
}

export interface BlogSettingsInput {
	title?: string;
	excerpt?: string;
	category?: string;
	authorName?: string;
	bodyHtml?: string;
}

export const listBlogPosts = () => apiFetch<BlogPostSummary[]>("/blog");

export const createBlogPost = (body: { title: string }) =>
	apiFetch<BlogPostSummary>("/blog", {
		method: "POST",
		body: JSON.stringify(body),
	});

export const getBlogPost = (id: string) =>
	apiFetch<BlogPostDetail>(`/blog/${id}`);

export const updateBlogPost = (id: string, body: BlogSettingsInput) =>
	apiFetch<BlogPostDetail>(`/blog/${id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});

export const deleteBlogPost = (id: string) =>
	apiFetch(`/blog/${id}`, { method: "DELETE" });

export const publishBlogPost = (id: string) =>
	apiFetch<BlogPostSummary>(`/blog/${id}/publish`, { method: "POST" });

export const uploadBlogCover = (
	id: string,
	file: File,
	onProgress?: (p: number) => void,
) =>
	uploadFile<{ coverKey: string; coverUrl: string }>(
		`/blog/${id}/cover`,
		file,
		onProgress,
	);

export const getPublishedPosts = () =>
	apiFetch<PublishedPost[]>("/catalog/posts");

export const getPublicPost = (slug: string) =>
	apiFetch<PublicPost>(`/catalog/posts/${slug}`);

// ── Assessments & questions (§4.4) ──────────────────────────────────────────
export type AssessmentScope =
	| "lesson_pre"
	| "lesson_post"
	| "module"
	| "course_final"
	| "path_final"
	| "cohort";
export type QuestionType = "mcq" | "true_false" | "short_answer";
export type AssessmentGradingType = "auto" | "manual" | "ai_assisted" | "peer";

export interface QuestionNode {
	id: string;
	type: QuestionType | null;
	body: string;
	optionsJson: string[] | null;
	correctAnswer: string | null;
	points: number;
	orderIndex: number | null;
}

export interface AssessmentSummary {
	id: string;
	scope: AssessmentScope;
	type: string | null;
	title: string | null;
	passMark: number;
	timeLimitMinutes: number | null;
	lessonId: string | null;
	moduleId: string | null;
	courseId: string | null;
	pathId: string | null;
	cohortId: string | null;
	_count?: { questions: number };
}

export interface AssessmentDetail extends AssessmentSummary {
	maxRetakes: number | null;
	retakeCooldownHours: number | null;
	questionPoolSize: number | null;
	shuffleQuestions: boolean;
	shuffleAnswers: boolean;
	anticheatTabSwitchLimit: number;
	anticheatFullscreenRequired: boolean;
	anticheatCameraRequired: boolean;
	anticheatCopyPasteBlocked: boolean;
	anticheatTimePerQuestionFlagSeconds: number;
	gradingType: AssessmentGradingType | null;
	scheduledAt: string | null;
	dueAt: string | null;
	questions: QuestionNode[];
	sourceLessons: { id: string; title: string; hasTranscript: boolean }[];
}

export interface CreateAssessmentInput {
	scope: AssessmentScope;
	title?: string;
	type?: string;
	lessonId?: string;
	moduleId?: string;
	courseId?: string;
	pathId?: string;
	cohortId?: string;
}

export interface AssessmentSettingsInput {
	title?: string;
	passMark?: number;
	timeLimitMinutes?: number | null;
	maxRetakes?: number | null;
	retakeCooldownHours?: number | null;
	questionPoolSize?: number | null;
	shuffleQuestions?: boolean;
	shuffleAnswers?: boolean;
	anticheatTabSwitchLimit?: number;
	anticheatFullscreenRequired?: boolean;
	anticheatCameraRequired?: boolean;
	anticheatCopyPasteBlocked?: boolean;
	anticheatTimePerQuestionFlagSeconds?: number;
	gradingType?: AssessmentGradingType;
	scheduledAt?: string | null;
	dueAt?: string | null;
}

export interface QuestionInput {
	type: QuestionType;
	body: string;
	options?: string[];
	correctAnswer?: string;
	points?: number;
}

export const listAssessments = (parent: {
	courseId?: string;
	moduleId?: string;
	lessonId?: string;
	pathId?: string;
	cohortId?: string;
}) => {
	const q = new URLSearchParams(
		Object.entries(parent).filter(([, v]) => Boolean(v)) as [string, string][],
	).toString();
	return apiFetch<AssessmentSummary[]>(`/assessments?${q}`);
};

export const getAssessment = (id: string) =>
	apiFetch<AssessmentDetail>(`/assessments/${id}`);

export const createAssessment = (body: CreateAssessmentInput) =>
	apiFetch<AssessmentSummary>("/assessments", {
		method: "POST",
		body: JSON.stringify(body),
	});

export const updateAssessment = (id: string, body: AssessmentSettingsInput) =>
	apiFetch<AssessmentDetail>(`/assessments/${id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});

export const deleteAssessment = (id: string) =>
	apiFetch(`/assessments/${id}`, { method: "DELETE" });

export const addQuestion = (assessmentId: string, body: QuestionInput) =>
	apiFetch<QuestionNode>(`/assessments/${assessmentId}/questions`, {
		method: "POST",
		body: JSON.stringify(body),
	});

export const updateQuestion = (
	questionId: string,
	body: Partial<QuestionInput>,
) =>
	apiFetch<QuestionNode>(`/assessments/questions/${questionId}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});

export const deleteQuestion = (questionId: string) =>
	apiFetch(`/assessments/questions/${questionId}`, { method: "DELETE" });

export const reorderQuestions = (assessmentId: string, questionIds: string[]) =>
	apiFetch(`/assessments/${assessmentId}/questions/reorder`, {
		method: "PATCH",
		body: JSON.stringify({ questionIds }),
	});

export const generateQuestions = (
	assessmentId: string,
	body: { lessonId?: string; count?: number; types?: QuestionType[] },
) =>
	apiFetch<QuestionNode[]>(`/assessments/${assessmentId}/generate`, {
		method: "POST",
		body: JSON.stringify(body),
	});

// ── Attempts (learner-facing, §4.6.3) ───────────────────────────────────────
export interface AttemptAnticheat {
	tabSwitchLimit: number;
	fullscreenRequired: boolean;
	cameraRequired: boolean;
	copyPasteBlocked: boolean;
}

export interface AttemptInfo {
	id: string;
	title: string | null;
	scope: AssessmentScope;
	passMark: number;
	timeLimitMinutes: number | null;
	questionCount: number;
	maxRetakes: number | null;
	retakeCooldownHours: number | null;
	anticheat: AttemptAnticheat;
	inProgressAttemptId: string | null;
	canStart: boolean;
	reason?: string;
	attemptsUsed: number;
	retakesRemaining: number | null;
	alreadyPassed: boolean;
	bestScore: number;
	cooldownUntil: string | null;
	lastAttemptId: string | null;
}

export interface AttemptQuestion {
	id: string;
	type: QuestionType | null;
	body: string;
	points: number;
	options: string[] | null;
}

export interface AttemptState {
	status: "in_progress";
	attemptId: string;
	assessmentId: string;
	title: string | null;
	attemptNumber: number;
	timeLimitMinutes: number | null;
	remainingSeconds: number | null;
	passMark: number;
	anticheat: AttemptAnticheat;
	questions: AttemptQuestion[];
	answers: Record<string, string>;
}

export interface AttemptReviewItem {
	id: string;
	type: QuestionType | null;
	body: string;
	options: string[] | null;
	points: number;
	yourAnswer: string | null;
	correctAnswer: string | null;
	correct: boolean;
}

export interface AttemptResult {
	status: "submitted";
	attemptId: string;
	assessmentId: string;
	title: string | null;
	attemptNumber: number;
	submittedAt: string | null;
	autoSubmitted: boolean;
	score: number;
	/** Best prior submitted score, for growth framing (§3.1); null on attempt 1. */
	previousBest: number | null;
	/** score − previousBest ("You've grown +X%"); null on attempt 1. */
	delta: number | null;
	passed: boolean | null;
	passMark: number;
	integrityScore: number;
	flagCount: number;
	review: AttemptReviewItem[];
}

export type AttemptSnapshot =
	| { status: "in_progress"; state: AttemptState }
	| { status: "submitted"; result: AttemptResult };

export const getAssessmentInfo = (id: string) =>
	apiFetch<AttemptInfo>(`/assessments/${id}/info`);

export const startAttempt = (id: string) =>
	apiFetch<AttemptState>(`/assessments/${id}/attempts`, { method: "POST" });

export const getAttempt = (attemptId: string) =>
	apiFetch<AttemptSnapshot>(`/attempts/${attemptId}`);

export const saveAttemptAnswer = (
	attemptId: string,
	questionId: string,
	answer: string,
) =>
	apiFetch<{ saved: boolean; remainingSeconds: number | null }>(
		`/attempts/${attemptId}/answer`,
		{ method: "PATCH", body: JSON.stringify({ questionId, answer }) },
	);

export const submitAttempt = (
	attemptId: string,
	answers?: Record<string, string>,
) =>
	apiFetch<AttemptResult>(`/attempts/${attemptId}/submit`, {
		method: "POST",
		body: JSON.stringify({ answers: answers ?? {} }),
	});

export const getAttemptResult = (attemptId: string) =>
	apiFetch<AttemptResult>(`/attempts/${attemptId}/result`);

// ── Read-only translation (§11) ─────────────────────────────────────────────
export type ContentLang = "en" | "fr" | "es" | "pcm";

/** Translate display text on demand (cached server-side; never used for grading). */
export const translateTexts = (texts: string[], language: ContentLang) =>
	apiFetch<{ translations: string[] }>("/i18n/translate", {
		method: "POST",
		body: JSON.stringify({ texts, language }),
	}).then((r) => r.translations);

// ── Anti-cheat ingestion (§4.6.3) ───────────────────────────────────────────
export type AntiCheatEventType =
	| "tab_switch"
	| "focus_loss"
	| "copy_attempt"
	| "paste_attempt"
	| "right_click"
	| "keyboard_shortcut"
	| "fullscreen_exit"
	| "camera_face_missing"
	| "camera_multiple_faces"
	| "fast_answer"
	| "viewport_change"
	| "devtools_open";

export interface AntiCheatEvent {
	eventType: AntiCheatEventType;
	severity?: "low" | "medium" | "high";
	occurredAt?: string;
	metadata?: Record<string, unknown>;
	screenshotKey?: string;
}

export interface AntiCheatAck {
	accepted: number;
	flagCount: number;
	integrityScore: number;
	autoSubmit: boolean;
	tabSwitches: number;
	tabSwitchLimit: number;
}

export const ingestAntiCheat = (attemptId: string, events: AntiCheatEvent[]) =>
	apiFetch<AntiCheatAck>(`/attempts/${attemptId}/anti-cheat`, {
		method: "POST",
		body: JSON.stringify({ events }),
	});

/** Upload a camera-monitoring thumbnail + flag (multipart). */
export async function uploadProctoringSnapshot(
	attemptId: string,
	blob: Blob,
	eventType: AntiCheatEventType,
): Promise<{
	stored: boolean;
	screenshotKey?: string;
	integrityScore: number;
	flagCount: number;
}> {
	const form = new FormData();
	form.append("file", blob, "snapshot.jpg");
	form.append("eventType", eventType);
	const res = await fetch(`${API_URL}/attempts/${attemptId}/proctoring`, {
		method: "POST",
		credentials: "include",
		body: form,
	});
	const body = res.ok ? await res.json() : null;
	if (!body?.success) {
		throw new Error(body?.error?.message ?? "Snapshot upload failed");
	}
	return body.data;
}

// ── Anti-cheat reporting (§4.6.4 — instructor/admin) ────────────────────────
export interface AttemptSummaryRow {
	id: string;
	attemptNumber: number;
	userName: string | null;
	userEmail: string | null;
	submittedAt: string | null;
	score: number | null;
	passed: boolean | null;
	integrityScore: number;
	flagCount: number;
	invalidated: boolean;
	escalated: boolean;
}

export interface AttemptReportEvent {
	id: string;
	eventType: AntiCheatEventType;
	severity: "low" | "medium" | "high";
	occurredAt: string;
	metadata: unknown;
	screenshotUrl: string | null;
}

export interface AttemptReport {
	id: string;
	attemptNumber: number;
	userName: string | null;
	userEmail: string | null;
	submittedAt: string | null;
	score: number | null;
	passed: boolean | null;
	autoSubmitted: boolean;
	integrityScore: number;
	flagCount: number;
	ipAddress: string | null;
	userAgent: string | null;
	invalidated: boolean;
	invalidatedReason: string | null;
	escalated: boolean;
	escalatedReason: string | null;
	events: AttemptReportEvent[];
}

export interface IntegrityReportRow extends AttemptSummaryRow {
	assessmentId: string | null;
	assessmentTitle: string | null;
	scope: AssessmentScope | null;
}

export const listAssessmentAttempts = (assessmentId: string) =>
	apiFetch<AttemptSummaryRow[]>(
		`/assessment-reports/assessment/${assessmentId}`,
	);

export const getAttemptReport = (attemptId: string) =>
	apiFetch<AttemptReport>(`/assessment-reports/attempt/${attemptId}`);

export const invalidateAttempt = (attemptId: string, reason?: string) =>
	apiFetch(`/assessment-reports/attempt/${attemptId}/invalidate`, {
		method: "POST",
		body: JSON.stringify({ reason }),
	});

export const acceptAttempt = (attemptId: string) =>
	apiFetch(`/assessment-reports/attempt/${attemptId}/accept`, {
		method: "POST",
		body: JSON.stringify({}),
	});

export const escalateAttempt = (attemptId: string, reason?: string) =>
	apiFetch(`/assessment-reports/attempt/${attemptId}/escalate`, {
		method: "POST",
		body: JSON.stringify({ reason }),
	});

export const listAllIntegrityReports = () =>
	apiFetch<IntegrityReportRow[]>("/assessment-reports/all");

// ── Projects (§4.5) ─────────────────────────────────────────────────────────
export type ProjectScope = "course" | "path" | "cohort";
export type ProjectSubmissionType =
	| "file_upload"
	| "text_submission"
	| "url_submission"
	| "peer_review";
export type ProjectGradingType = "manual" | "peer_review" | "ai_assisted";

export interface RubricCriterion {
	id?: string;
	label: string;
	maxPoints: number;
	description?: string | null;
}

export interface ProjectSummary {
	id: string;
	scope: ProjectScope;
	title: string;
	description: string | null;
	submissionTypes: string[];
	gradingType: ProjectGradingType;
	passMark: number;
	dueAt: string | null;
	courseId: string | null;
	pathId: string | null;
	cohortId: string | null;
	orderIndex: number;
	_count?: { submissions: number };
}

export interface ProjectDetail extends ProjectSummary {
	rubricJson: RubricCriterion[] | null;
	allowedFileTypes: string[];
	maxFileSizeMb: number;
	peerReviewCount: number;
}

export interface CreateProjectInput {
	scope: ProjectScope;
	title: string;
	courseId?: string;
	pathId?: string;
	cohortId?: string;
}

export interface ProjectSettingsInput {
	title?: string;
	description?: string;
	submissionTypes?: ProjectSubmissionType[];
	allowedFileTypes?: string[];
	maxFileSizeMb?: number;
	passMark?: number;
	gradingType?: ProjectGradingType;
	peerReviewCount?: number;
	dueAt?: string | null;
	rubric?: RubricCriterion[];
}

export const listProjects = (parent: {
	courseId?: string;
	pathId?: string;
	cohortId?: string;
}) => {
	const q = new URLSearchParams(
		Object.entries(parent).filter(([, v]) => Boolean(v)) as [string, string][],
	).toString();
	return apiFetch<ProjectSummary[]>(`/projects?${q}`);
};

export const getProject = (id: string) =>
	apiFetch<ProjectDetail>(`/projects/${id}`);

export const createProject = (body: CreateProjectInput) =>
	apiFetch<ProjectSummary>("/projects", {
		method: "POST",
		body: JSON.stringify(body),
	});

export const updateProject = (id: string, body: ProjectSettingsInput) =>
	apiFetch<ProjectDetail>(`/projects/${id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});

export const deleteProject = (id: string) =>
	apiFetch(`/projects/${id}`, { method: "DELETE" });

// ── Project submission + grading (§4.5) ─────────────────────────────────────
export interface SubmissionFileRef {
	name: string;
	url: string;
}

export interface MySubmission {
	id: string;
	attemptNumber: number;
	submittedAt: string | null;
	textContent: string | null;
	urlSubmission: string | null;
	files: SubmissionFileRef[];
	graded: boolean;
	score: number | null;
	passed: boolean | null;
	feedback: string | null;
	peerReviewsAssigned: number;
	peerReviewsCompleted: number;
}

export interface ProjectInfo {
	id: string;
	title: string;
	description: string | null;
	scope: ProjectScope;
	submissionTypes: string[];
	gradingType: ProjectGradingType;
	passMark: number;
	dueAt: string | null;
	maxFileSizeMb: number;
	allowedFileTypes: string[];
	peerReviewCount: number;
	rubric: RubricCriterion[] | null;
	mySubmission: MySubmission | null;
	peerReview: { required: number; completed: number } | null;
}

export interface SubmissionRow {
	id: string;
	attemptNumber: number;
	userName: string | null;
	userEmail: string | null;
	submittedAt: string | null;
	graded: boolean;
	score: number | null;
	passed: boolean | null;
}

export interface SubmissionForGrading {
	id: string;
	attemptNumber: number;
	userName: string | null;
	userEmail: string | null;
	submittedAt: string | null;
	textContent: string | null;
	urlSubmission: string | null;
	files: SubmissionFileRef[];
	projectId: string;
	projectTitle: string;
	brief: string | null;
	gradingType: ProjectGradingType;
	passMark: number;
	rubric: RubricCriterion[];
	graded: boolean;
	score: number | null;
	passed: boolean | null;
	feedback: string | null;
	rubricScores: { criterionId: string; points: number }[] | null;
}

export interface AiGradeDraft {
	scores: { criterionId: string; points: number; comment: string }[];
	feedback: string;
}

export const getProjectInfo = (projectId: string) =>
	apiFetch<ProjectInfo>(`/projects/${projectId}/info`);

export const submitProject = (
	projectId: string,
	body: {
		textContent?: string;
		urlSubmission?: string;
		files?: { key: string; name: string }[];
	},
) =>
	apiFetch<MySubmission>(`/projects/${projectId}/submit`, {
		method: "POST",
		body: JSON.stringify(body),
	});

export const uploadProjectFile = (
	projectId: string,
	file: File,
	onProgress?: (p: number) => void,
) =>
	uploadFile<{ key: string; name: string; url: string }>(
		`/projects/${projectId}/files`,
		file,
		onProgress,
	);

export const listProjectSubmissions = (projectId: string) =>
	apiFetch<SubmissionRow[]>(`/projects/${projectId}/submissions`);

export const getSubmissionForGrading = (submissionId: string) =>
	apiFetch<SubmissionForGrading>(`/projects/submissions/${submissionId}`);

export const aiDraftGrade = (submissionId: string) =>
	apiFetch<AiGradeDraft>(`/projects/submissions/${submissionId}/ai-draft`, {
		method: "POST",
		body: JSON.stringify({}),
	});

export const gradeSubmission = (
	submissionId: string,
	body: {
		rubricScores?: { criterionId: string; points: number }[];
		score?: number;
		passed?: boolean;
		feedback?: string;
	},
) =>
	apiFetch<{ id: string; score: number | null; passed: boolean | null }>(
		`/projects/submissions/${submissionId}/grade`,
		{ method: "POST", body: JSON.stringify(body) },
	);

// ── Peer review (§4.5) ──────────────────────────────────────────────────────
export interface PeerReviewItem {
	reviewId: string;
	label: string;
	textContent: string | null;
	urlSubmission: string | null;
	files: SubmissionFileRef[];
	done: boolean;
	myScores: { criterionId: string; points: number }[];
	myFeedback: string | null;
}

export interface MyPeerReviews {
	projectId: string;
	projectTitle: string;
	rubric: RubricCriterion[] | null;
	passMark: number;
	required: number;
	completed: number;
	reviews: PeerReviewItem[];
}

export const listMyPeerReviews = (projectId: string) =>
	apiFetch<MyPeerReviews>(`/projects/${projectId}/peer-reviews`);

export const submitPeerReview = (
	reviewId: string,
	body: {
		rubricScores?: { criterionId: string; points: number }[];
		feedback?: string;
	},
) =>
	apiFetch<{ done: boolean }>(`/peer-reviews/${reviewId}`, {
		method: "POST",
		body: JSON.stringify(body),
	});

// ── Course completion (§4.3) ────────────────────────────────────────────────
export interface CourseProgressLesson {
	id: string;
	title: string;
	contentType: string | null;
	done: boolean;
	percent: number;
}

export interface CourseProgressModule {
	id: string;
	title: string;
	lessons: CourseProgressLesson[];
	assessment: { id: string; passed: boolean } | null;
}

export interface CourseProgressProject {
	id: string;
	title: string;
	gradingType: ProjectGradingType;
	passed: boolean;
}

export interface CourseProgress {
	course: {
		id: string;
		title: string;
		description: string | null;
		thumbnailUrl: string | null;
	};
	modules: CourseProgressModule[];
	projects: CourseProgressProject[];
	finalAssessment: { id: string; passed: boolean; required: boolean } | null;
	summary: {
		lessonsDone: number;
		lessonsTotal: number;
		allLessonsDone: boolean;
		allModuleAssessmentsPassed: boolean;
		finalAssessmentPassed: boolean;
		allProjectsPassed: boolean;
		isComplete: boolean;
		percent: number;
	};
}

export const getCourseProgress = (courseId: string) =>
	apiFetch<CourseProgress>(`/completion/courses/${courseId}`);

export interface LessonProgressResult {
	lessonId: string;
	watchedPct: number;
	done: boolean;
	course: CourseProgress;
}

/**
 * Reports lesson consumption (watched % or scroll-to-end). The server decides
 * completion per §4.3 — there is no manual "mark complete".
 */
export const reportLessonProgress = (
	lessonId: string,
	body: { videoWatchedPct?: number; scrolledToEnd?: boolean },
) =>
	apiFetch<LessonProgressResult>(`/completion/lessons/${lessonId}/progress`, {
		method: "POST",
		body: JSON.stringify(body),
	});

// ── Lesson player context + path/cohort completion ──────────────────────────
export interface LessonContextItem {
	id: string;
	title: string;
	contentType: string | null;
	moduleTitle: string;
	done: boolean;
}

export interface LessonQuizRef {
	id: string;
	passed: boolean;
	/** Best non-invalidated score, so the player can frame pre→post growth (§3.1). */
	bestScore: number | null;
}

export interface LessonContext {
	lesson: {
		id: string;
		title: string;
		contentType: string | null;
		minVideoWatchPct: number;
		hasPreQuiz: boolean;
		hasPostQuiz: boolean;
	};
	course: { id: string; title: string };
	lessons: LessonContextItem[];
	preQuiz: LessonQuizRef | null;
	postQuiz: LessonQuizRef | null;
	resumePct: number;
	prevLessonId: string | null;
	nextLessonId: string | null;
	position: { index: number; total: number };
	done: boolean;
}

export const getLessonContext = (lessonId: string) =>
	apiFetch<LessonContext>(`/completion/lessons/${lessonId}/context`);

export interface PathProgressCourse {
	id: string;
	title: string;
	isRequired: boolean;
	isComplete: boolean;
	percent: number;
}

export interface PathProgress {
	path: { id: string; title: string };
	courses: PathProgressCourse[];
	summary: {
		coursesTotal: number;
		coursesComplete: number;
		isComplete: boolean;
		percent: number;
	};
}

export const getPathProgress = (pathId: string) =>
	apiFetch<PathProgress>(`/completion/paths/${pathId}`);

export interface CohortProgress {
	cohort: { id: string; title: string };
	courses: {
		id: string;
		title: string;
		isComplete: boolean;
		percent: number;
	}[];
	paths: {
		id: string;
		title: string;
		isComplete: boolean;
		percent: number;
	}[];
	assessments: { id: string; title: string | null; passed: boolean }[];
	projects: {
		id: string;
		title: string;
		gradingType: ProjectGradingType;
		passed: boolean;
	}[];
	summary: {
		coursesComplete: number;
		coursesTotal: number;
		pathsComplete: number;
		pathsTotal: number;
		allAssessmentsPassed: boolean;
		allProjectsPassed: boolean;
		isComplete: boolean;
		percent: number;
	};
}

export const getCohortProgress = (cohortId: string) =>
	apiFetch<CohortProgress>(`/completion/cohorts/${cohortId}`);

// ── My Learning (started/completed entities) ────────────────────────────────
export interface MyLearningItem {
	type: "course" | "path" | "cohort";
	id: string;
	title: string;
	slug: string;
	thumbnailUrl: string | null;
	isFree: boolean;
	isEarnBackEligible: boolean;
	earnBackPercentage: number | null;
	percent: number;
	isComplete: boolean;
}

export interface MyLearning {
	courses: MyLearningItem[];
	paths: MyLearningItem[];
	cohorts: MyLearningItem[];
}

export const getMyLearning = () => apiFetch<MyLearning>("/completion/mine");

// ── Enrolment ───────────────────────────────────────────────────────────────
export type EnrollableType = "course" | "path" | "cohort";

export const getEnrollmentStatus = (type: EnrollableType, id: string) =>
	apiFetch<{ enrolled: boolean }>(`/enrollments/${type}/${id}`);

export const enroll = (type: EnrollableType, id: string) =>
	apiFetch<{ enrolled: true }>(`/enrollments/${type}/${id}`, {
		method: "POST",
	});

// ── Onboarding (§8.1) ───────────────────────────────────────────────────────
export interface LearnerOnboardingPayload {
	language?: string;
	goals?: string[];
	skillLevel?: string;
	weeklyHours?: string;
	studySchedule?: string;
	/** Habit-stacking anchor (§3.1) — the daily habit study time is tied to. */
	studyAnchor?: string;
	whatsappOptIn?: boolean;
	phone?: string;
}

export interface InstructorOnboardingPayload {
	headline?: string;
	bio?: string;
	expertiseAreas?: string[];
}

export const saveLearnerOnboarding = (payload: LearnerOnboardingPayload) =>
	apiFetch<{ ok: true }>("/onboarding/learner", {
		method: "POST",
		body: JSON.stringify(payload),
	});

export const saveInstructorOnboarding = (
	payload: InstructorOnboardingPayload,
) =>
	apiFetch<{ ok: true }>("/onboarding/instructor", {
		method: "POST",
		body: JSON.stringify(payload),
	});

export interface EditableProfile {
	firstName: string;
	lastName: string;
	otherNames: string | null;
	name: string;
	email: string;
	phone: string | null;
	phoneVerified: boolean;
	language: string;
	headline: string | null;
	bio: string | null;
	expertiseAreas: string[];
	image: string | null;
	whatsappOptIn: boolean;
	studySchedule: string | null;
	studyAnchor: string | null;
	weeklyHours: string | null;
	timezone: string | null;
}

export interface UpdateProfilePayload {
	firstName?: string;
	lastName?: string;
	otherNames?: string;
	phone?: string;
	language?: string;
	headline?: string;
	bio?: string;
	expertiseAreas?: string[];
	whatsappOptIn?: boolean;
	studySchedule?: string;
	/** "" clears the anchor. */
	studyAnchor?: string;
	weeklyHours?: string;
	timezone?: string;
}

export const getMyProfile = () =>
	apiFetch<EditableProfile>("/onboarding/profile");

export const updateMyProfile = (payload: UpdateProfilePayload) =>
	apiFetch<{ ok: true }>("/onboarding/profile", {
		method: "PATCH",
		body: JSON.stringify(payload),
	});

export const uploadAvatar = (file: File, onProgress?: (pct: number) => void) =>
	uploadFile<{ image: string }>("/onboarding/avatar", file, onProgress);

export const deleteAvatar = () =>
	apiFetch<{ image: string | null }>("/onboarding/avatar", {
		method: "DELETE",
	});
