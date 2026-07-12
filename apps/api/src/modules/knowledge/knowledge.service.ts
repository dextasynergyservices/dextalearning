import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AI_PORT, type AiPort } from "../../shared/ai/ai.port";
import { shortHash } from "../../shared/ai/hash.util";
import { CACHE_PORT, type CachePort } from "../../shared/cache/cache.port";
import { chunkText } from "./chunk";
import { EmbeddingStore, type SearchHit } from "./embedding.store";

const QUERY_EMBED_TTL_SECONDS = 60 * 60;

export interface IndexInput {
	lessonId: string;
	lessonTitle: string;
	courseId: string | null;
	transcriptText: string;
}

/**
 * Knowledge / RAG context (§4.10, §7) — owns `content_embeddings`. Indexes
 * lesson transcripts (chunk → embed → store) and answers semantic-search
 * queries over them. Depends only on the AI port + its own store, so it could
 * be extracted with just those changing (§6.4).
 */
@Injectable()
export class KnowledgeService {
	constructor(
		@Inject(AI_PORT) private readonly ai: AiPort,
		private readonly store: EmbeddingStore,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
		private readonly prisma: PrismaService,
	) {}

	/** Embed a search query, caching the vector so repeat searches are free. */
	private async embedQuery(q: string): Promise<number[] | null> {
		const key = `emb:q:v1:${shortHash(q)}`;
		const cached = await this.cache.get<number[]>(key);
		if (cached) return cached;
		const [vec] = await this.ai.embed([q], "query");
		if (!vec) return null;
		await this.cache.set(key, vec, QUERY_EMBED_TTL_SECONDS);
		return vec;
	}

	/** (Re)index a lesson's transcript. Empty transcript → drop its chunks. */
	async indexLesson(input: IndexInput): Promise<{ chunks: number }> {
		const chunks = chunkText(input.transcriptText ?? "");
		if (chunks.length === 0) {
			await this.store.deleteLesson(input.lessonId);
			return { chunks: 0 };
		}
		const vectors = await this.ai.embed(chunks, "document");
		await this.store.replaceLesson(
			input.lessonId,
			input.lessonTitle,
			input.courseId,
			chunks.map((content, i) => ({
				chunkIndex: i,
				content,
				embedding: vectors[i] ?? [],
			})),
		);
		return { chunks: chunks.length };
	}

	/** Nearest passages to a free-text query, optionally scoped. */
	async search(
		query: string,
		scope: { lessonId?: string; courseIds?: string[]; limit?: number } = {},
	): Promise<SearchHit[]> {
		const q = query.trim();
		if (!q) return [];
		const vec = await this.embedQuery(q);
		if (!vec) return [];
		return this.store.search(vec, scope);
	}

	/** Search a set of courses, collapsed to the best passage per lesson. */
	private async searchCourses(
		courseIds: string[],
		query: string,
		limit: number,
	): Promise<{ lessonId: string; lessonTitle: string; snippet: string }[]> {
		if (courseIds.length === 0) return [];
		const hits = await this.search(query, { courseIds, limit: limit * 3 });
		const bestByLesson = new Map<string, SearchHit>();
		for (const hit of hits) {
			if (!bestByLesson.has(hit.lessonId)) bestByLesson.set(hit.lessonId, hit);
		}
		return [...bestByLesson.values()].slice(0, limit).map((h) => ({
			lessonId: h.lessonId,
			lessonTitle: h.lessonTitle,
			snippet: h.content,
		}));
	}

	/** Semantic search over one course (the shape the search UI wants). */
	searchCourse(courseId: string, query: string, limit = 6) {
		return this.searchCourses([courseId], query, limit);
	}

	/** Search a path — over the transcripts of all its member courses (§4.10). */
	async searchPath(pathId: string, query: string, limit = 6) {
		const links = await this.prisma.pathCourse.findMany({
			where: { pathId },
			select: { courseId: true },
		});
		return this.searchCourses(
			links.map((l) => l.courseId),
			query,
			limit,
		);
	}

	/** Search a cohort — over its direct courses AND the courses of its paths. */
	async searchCohort(cohortId: string, query: string, limit = 6) {
		const [directCourses, cohortPaths] = await Promise.all([
			this.prisma.cohortCourse.findMany({
				where: { cohortId },
				select: { courseId: true },
			}),
			this.prisma.cohortPath.findMany({
				where: { cohortId },
				select: { pathId: true },
			}),
		]);
		const pathCourses = cohortPaths.length
			? await this.prisma.pathCourse.findMany({
					where: { pathId: { in: cohortPaths.map((p) => p.pathId) } },
					select: { courseId: true },
				})
			: [];
		const courseIds = [
			...new Set([
				...directCourses.map((c) => c.courseId),
				...pathCourses.map((c) => c.courseId),
			]),
		];
		return this.searchCourses(courseIds, query, limit);
	}
}
