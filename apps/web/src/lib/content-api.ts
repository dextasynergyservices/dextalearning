import { apiFetch } from "./api";

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
	duration?: number | null;
}

export function getMediaToken(lessonId: string): Promise<MediaToken> {
	return apiFetch<MediaToken>(`/lessons/${lessonId}/media-token`);
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
	_count: { modules: number };
}

export interface PublicLesson {
	id: string;
	title: string;
	contentType: "video" | "text" | "pdf" | "audio" | null;
	orderIndex: number;
	videoDurationSec: number | null;
	audioDurationSec: number | null;
}

export interface PublicCourse extends Commercials {
	id: string;
	title: string;
	slug: string;
	description: string | null;
	level: string | null;
	language: string;
	earnBackDeadlineDays: number | null;
	modules: {
		id: string;
		title: string;
		orderIndex: number;
		lessons: PublicLesson[];
	}[];
}

export const getPublishedCourses = () =>
	apiFetch<PublishedCourse[]>("/catalog/courses");

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
	transcriptText: string | null;
	videoKeysJson: unknown;
	videoDurationSec: number | null;
	videoThumbnailKey: string | null;
	audioKey: string | null;
	audioDurationSec: number | null;
	audioSizeBytes: number | null;
	pdfKey: string | null;
	contentText: string | null;
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
	hasFinalAssessment: boolean;
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
	hasFinalAssessment?: boolean;
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

export const updateTranscript = (lessonId: string, text: string) =>
	apiFetch(`/lessons/${lessonId}/transcript`, {
		method: "PATCH",
		body: JSON.stringify({ text }),
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
	_count?: { modules: number };
}

export interface PathCourseNode {
	orderIndex: number;
	isRequired: boolean;
	course: PathCourseRef;
}

export interface PathDetail extends PathSummary {
	description: string | null;
	outcomeStatement: string | null;
	earnBackDeadlineDays: number | null;
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
	earnBackDeadlineDays: number | null;
	pathCourses: PathCourseNode[];
}

export interface PathSettingsInput {
	title?: string;
	description?: string;
	level?: string;
	outcomeStatement?: string;
	estimatedHours?: number;
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

export interface CohortDetail extends CohortSummary {
	description: string | null;
	examMode: string | null;
	unlockMode: string | null;
	groupingMode: string;
	targetGroupSize: number;
	minGroupSize: number;
	maxGroupSize: number;
	courses: CohortCourseNode[];
	instructors: { user: CohortStaff }[];
	facilitators: { user: CohortStaff }[];
	availableCourses: CohortCourseNode["course"][];
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
	_count: { courses: number };
}

export interface PublicCohort extends PublishedCohort {
	examMode: string | null;
	courses: CohortCourseNode[];
	instructors: { user: { id: string; name: string | null } }[];
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

export const publishCohort = (id: string) =>
	apiFetch<CohortSummary>(`/cohorts/${id}/publish`, { method: "POST" });

export const addCohortCourse = (id: string, courseId: string) =>
	apiFetch(`/cohorts/${id}/courses`, {
		method: "POST",
		body: JSON.stringify({ courseId }),
	});

export const removeCohortCourse = (id: string, courseId: string) =>
	apiFetch(`/cohorts/${id}/courses/${courseId}`, { method: "DELETE" });

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
