-- Knowledge / RAG store (§4.10, §7). Owned by the knowledge bounded context and
-- normally self-provisioned by KnowledgeModule.onModuleInit() on boot. This file
-- is the same DDL, for running by hand where the runtime DB role can't CREATE
-- EXTENSION (locked-down managed Postgres). Fully idempotent — safe to re-run.
--
-- Dev/prod:  bun run db:embeddings           (targets DATABASE_URL)
-- Manual:    psql "$DATABASE_URL" -f apps/api/prisma/sql/content_embeddings.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS content_embeddings (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id    text NOT NULL,
    lesson_title text NOT NULL DEFAULT '',
    course_id    text,
    chunk_index  integer NOT NULL,
    content      text NOT NULL,
    embedding    vector(768) NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_embeddings_lesson_idx
    ON content_embeddings (lesson_id);

CREATE INDEX IF NOT EXISTS content_embeddings_course_idx
    ON content_embeddings (course_id);

CREATE INDEX IF NOT EXISTS content_embeddings_vec_idx
    ON content_embeddings USING hnsw (embedding vector_cosine_ops);
