CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "chat_sessions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "scope" TEXT NOT NULL DEFAULT 'my_notes',
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "filters" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "chat_messages_role_check" CHECK ("role" IN ('user', 'assistant'))
);

CREATE INDEX IF NOT EXISTS "chat_sessions_user_updated_idx"
    ON "chat_sessions" ("user_id", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "chat_messages_session_created_idx"
    ON "chat_messages" ("session_id", "created_at" ASC);

