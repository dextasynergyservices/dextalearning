import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EMBED_DIMENSIONS } from "../../shared/ai/ai.port";

export interface EmbeddingChunk {
	chunkIndex: number;
	content: string;
	embedding: number[];
}

export interface SearchHit {
	lessonId: string;
	lessonTitle: string;
	courseId: string | null;
	content: string;
	distance: number;
}

/** Serialise a vector to pgvector's text form: `[0.1,0.2,…]`. */
function toVectorLiteral(vec: number[]): string {
	return `[${vec.map((x) => (Number.isFinite(x) ? x : 0)).join(",")}]`;
}

/**
 * Raw-SQL store for `content_embeddings` (§7). The knowledge context OWNS this
 * table end-to-end and provisions it itself (idempotent DDL) — pgvector's
 * `vector` type and HNSW index can't be modelled in Prisma, so keeping it out
 * of schema.prisma is deliberate, not an oversight. No FKs: lesson/course ids
 * and the lesson title are snapshots (§6.4 rule 5), so search never joins back
 * into content tables.
 */
@Injectable()
export class EmbeddingStore {
	constructor(private readonly prisma: PrismaService) {}

	/** Create the extension, table and indexes if missing. Safe to call often. */
	async ensureSchema(): Promise<void> {
		await this.prisma.$executeRawUnsafe(
			`CREATE EXTENSION IF NOT EXISTS vector`,
		);
		await this.prisma.$executeRawUnsafe(
			`CREATE TABLE IF NOT EXISTS content_embeddings (
				id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
				lesson_id text NOT NULL,
				lesson_title text NOT NULL DEFAULT '',
				course_id text,
				chunk_index integer NOT NULL,
				content text NOT NULL,
				embedding vector(${EMBED_DIMENSIONS}) NOT NULL,
				created_at timestamptz NOT NULL DEFAULT now()
			)`,
		);
		await this.prisma.$executeRawUnsafe(
			`CREATE INDEX IF NOT EXISTS content_embeddings_lesson_idx ON content_embeddings (lesson_id)`,
		);
		await this.prisma.$executeRawUnsafe(
			`CREATE INDEX IF NOT EXISTS content_embeddings_course_idx ON content_embeddings (course_id)`,
		);
		await this.prisma.$executeRawUnsafe(
			`CREATE INDEX IF NOT EXISTS content_embeddings_vec_idx ON content_embeddings USING hnsw (embedding vector_cosine_ops)`,
		);
	}

	/** Replace all chunks for a lesson in one transaction (re-index is idempotent). */
	async replaceLesson(
		lessonId: string,
		lessonTitle: string,
		courseId: string | null,
		chunks: EmbeddingChunk[],
	): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			await tx.$executeRawUnsafe(
				`DELETE FROM content_embeddings WHERE lesson_id = $1`,
				lessonId,
			);
			for (const chunk of chunks) {
				await tx.$executeRawUnsafe(
					`INSERT INTO content_embeddings
						(lesson_id, lesson_title, course_id, chunk_index, content, embedding)
					 VALUES ($1, $2, $3, $4, $5, $6::vector)`,
					lessonId,
					lessonTitle,
					courseId,
					chunk.chunkIndex,
					chunk.content,
					toVectorLiteral(chunk.embedding),
				);
			}
		});
	}

	/** Remove every chunk for a lesson (transcript cleared). */
	async deleteLesson(lessonId: string): Promise<void> {
		await this.prisma.$executeRawUnsafe(
			`DELETE FROM content_embeddings WHERE lesson_id = $1`,
			lessonId,
		);
	}

	/**
	 * Nearest chunks by cosine distance, optionally scoped to a lesson or a set
	 * of courses (a course/path/cohort resolves to its course ids upstream).
	 */
	async search(
		queryEmbedding: number[],
		opts: { lessonId?: string; courseIds?: string[]; limit?: number } = {},
	): Promise<SearchHit[]> {
		const limit = Math.min(Math.max(opts.limit ?? 5, 1), 50);
		const courseIds = opts.courseIds?.length ? opts.courseIds : null;
		return this.prisma.$queryRawUnsafe<SearchHit[]>(
			`SELECT lesson_id AS "lessonId",
			        lesson_title AS "lessonTitle",
			        course_id AS "courseId",
			        content,
			        (embedding <=> $1::vector) AS distance
			 FROM content_embeddings
			 WHERE ($2::text IS NULL OR lesson_id = $2)
			   AND ($3::text[] IS NULL OR course_id = ANY($3))
			 ORDER BY embedding <=> $1::vector
			 LIMIT ${limit}`,
			toVectorLiteral(queryEmbedding),
			opts.lessonId ?? null,
			courseIds,
		);
	}
}
