-- Add MeetingPlatform enum
DO $$ BEGIN
    CREATE TYPE "MeetingPlatform" AS ENUM ('MANUAL', 'GOOGLE_MEET', 'MS_TEAMS', 'ZOOM', 'UNKNOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add missing columns to meeting_sessions
ALTER TABLE "meeting_sessions"
    ADD COLUMN IF NOT EXISTS "platform" "MeetingPlatform" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS "title" TEXT,
    ADD COLUMN IF NOT EXISTS "participants" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add missing columns to transcript_chunks
ALTER TABLE "transcript_chunks"
    ADD COLUMN IF NOT EXISTS "sequence" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;

-- Add missing index for transcript_chunks sequence
CREATE INDEX IF NOT EXISTS "transcript_chunks_meeting_session_id_sequence_idx"
    ON "transcript_chunks"("meeting_session_id", "sequence");
