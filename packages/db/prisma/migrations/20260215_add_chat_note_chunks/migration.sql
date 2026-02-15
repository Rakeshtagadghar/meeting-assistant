CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "note_chunks" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "note_id" UUID NOT NULL REFERENCES "notes"("id") ON DELETE CASCADE,
    "source_type" TEXT NOT NULL,
    "chunk_key" TEXT NOT NULL UNIQUE,
    "chunk_index" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "t_start_ms" INTEGER,
    "t_end_ms" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "embedding" vector(768) NOT NULL
);

CREATE INDEX IF NOT EXISTS "note_chunks_user_id_idx"
    ON "note_chunks" ("user_id");

CREATE INDEX IF NOT EXISTS "note_chunks_note_id_idx"
    ON "note_chunks" ("note_id");

CREATE INDEX IF NOT EXISTS "note_chunks_user_note_idx"
    ON "note_chunks" ("user_id", "note_id");

CREATE INDEX IF NOT EXISTS "note_chunks_embedding_idx"
    ON "note_chunks"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);
