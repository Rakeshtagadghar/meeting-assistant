-- Create Enums (Idempotent)
DO $$ BEGIN
    CREATE TYPE "NoteType" AS ENUM ('FREEFORM', 'MEETING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MeetingSessionSource" AS ENUM ('MANUAL', 'CALENDAR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MeetingSessionStatus" AS ENUM ('IDLE', 'RECORDING', 'PAUSED', 'STOPPED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AISummaryKind" AS ENUM ('SUMMARY', 'ACTION_ITEMS', 'DECISIONS', 'RISKS', 'KEY_POINTS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ShareVisibility" AS ENUM ('PRIVATE', 'RESTRICTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProcessingJobKind" AS ENUM ('SUMMARIZE', 'EXTRACT_ACTIONS', 'GENERATE_HTML', 'EXPORT_PDF', 'EXPORT_DOCX');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ProcessingJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ArtifactType" AS ENUM ('MARKDOWN_SUMMARY', 'HTML_SUMMARY', 'PDF', 'DOCX');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ArtifactStatus" AS ENUM ('NOT_READY', 'GENERATING', 'READY', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Tables

CREATE TABLE IF NOT EXISTS "notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content_rich" JSONB NOT NULL DEFAULT '{}',
    "content_plain" TEXT NOT NULL DEFAULT '',
    "type" "NoteType" NOT NULL DEFAULT 'FREEFORM',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "folder_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "meeting_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "note_id" UUID NOT NULL,
    "source" "MeetingSessionSource" NOT NULL DEFAULT 'MANUAL',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "consent_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "consent_text" TEXT,
    "audio_stored" BOOLEAN NOT NULL DEFAULT false,
    "status" "MeetingSessionStatus" NOT NULL DEFAULT 'IDLE',

    CONSTRAINT "meeting_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "transcript_chunks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "meeting_session_id" UUID NOT NULL,
    "t_start_ms" INTEGER NOT NULL,
    "t_end_ms" INTEGER NOT NULL,
    "speaker" TEXT,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "note_id" UUID NOT NULL,
    "meeting_session_id" UUID,
    "kind" "AISummaryKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "model_info" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_summaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "share_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "note_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "visibility" "ShareVisibility" NOT NULL DEFAULT 'PRIVATE',
    "allowed_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "note_processing_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "note_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "ProcessingJobKind" NOT NULL,
    "status" "ProcessingJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_processing_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "note_artifacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "note_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "status" "ArtifactStatus" NOT NULL DEFAULT 'NOT_READY',
    "storage_path" TEXT,
    "hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_artifacts_pkey" PRIMARY KEY ("id")
);


-- Indexes & Uniques

CREATE INDEX IF NOT EXISTS "notes_user_id_idx" ON "notes"("user_id");
CREATE INDEX IF NOT EXISTS "notes_user_id_deleted_at_idx" ON "notes"("user_id", "deleted_at");
CREATE INDEX IF NOT EXISTS "notes_user_id_pinned_idx" ON "notes"("user_id", "pinned");
CREATE INDEX IF NOT EXISTS "notes_user_id_updated_at_idx" ON "notes"("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "notes_user_id_folder_id_idx" ON "notes"("user_id", "folder_id");

CREATE INDEX IF NOT EXISTS "meeting_sessions_user_id_idx" ON "meeting_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "meeting_sessions_note_id_idx" ON "meeting_sessions"("note_id");

CREATE INDEX IF NOT EXISTS "transcript_chunks_meeting_session_id_idx" ON "transcript_chunks"("meeting_session_id");
CREATE INDEX IF NOT EXISTS "transcript_chunks_meeting_session_id_t_start_ms_idx" ON "transcript_chunks"("meeting_session_id", "t_start_ms");

CREATE INDEX IF NOT EXISTS "ai_summaries_note_id_idx" ON "ai_summaries"("note_id");
CREATE INDEX IF NOT EXISTS "ai_summaries_note_id_kind_idx" ON "ai_summaries"("note_id", "kind");

CREATE UNIQUE INDEX IF NOT EXISTS "share_links_token_key" ON "share_links"("token");
CREATE INDEX IF NOT EXISTS "share_links_note_id_idx" ON "share_links"("note_id");
CREATE INDEX IF NOT EXISTS "share_links_token_idx" ON "share_links"("token");

CREATE INDEX IF NOT EXISTS "note_processing_jobs_note_id_idx" ON "note_processing_jobs"("note_id");
CREATE INDEX IF NOT EXISTS "note_processing_jobs_user_id_idx" ON "note_processing_jobs"("user_id");
CREATE INDEX IF NOT EXISTS "note_processing_jobs_user_id_status_idx" ON "note_processing_jobs"("user_id", "status");

CREATE INDEX IF NOT EXISTS "note_artifacts_note_id_idx" ON "note_artifacts"("note_id");
CREATE INDEX IF NOT EXISTS "note_artifacts_job_id_idx" ON "note_artifacts"("job_id");
CREATE INDEX IF NOT EXISTS "note_artifacts_note_id_type_idx" ON "note_artifacts"("note_id", "type");


-- Foreign Keys

DO $$ BEGIN
    ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "meeting_sessions" ADD CONSTRAINT "meeting_sessions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "transcript_chunks" ADD CONSTRAINT "transcript_chunks_meeting_session_id_fkey" FOREIGN KEY ("meeting_session_id") REFERENCES "meeting_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_meeting_session_id_fkey" FOREIGN KEY ("meeting_session_id") REFERENCES "meeting_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "share_links" ADD CONSTRAINT "share_links_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "share_links" ADD CONSTRAINT "share_links_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "note_processing_jobs" ADD CONSTRAINT "note_processing_jobs_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "note_processing_jobs" ADD CONSTRAINT "note_processing_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "note_artifacts" ADD CONSTRAINT "note_artifacts_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "note_artifacts" ADD CONSTRAINT "note_artifacts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "note_processing_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
