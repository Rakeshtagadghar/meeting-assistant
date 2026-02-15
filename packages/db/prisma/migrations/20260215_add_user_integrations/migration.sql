DO $$ BEGIN
    CREATE TYPE "IntegrationProvider" AS ENUM ('NOTION', 'SLACK', 'TRELLO', 'ZAPIER', 'GOOGLE_DOCS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "user_integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "metadata_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_integrations_user_id_provider_key"
    ON "user_integrations"("user_id", "provider");

CREATE INDEX IF NOT EXISTS "user_integrations_user_id_idx"
    ON "user_integrations"("user_id");

CREATE INDEX IF NOT EXISTS "user_integrations_provider_idx"
    ON "user_integrations"("provider");

DO $$ BEGIN
    ALTER TABLE "user_integrations"
      ADD CONSTRAINT "user_integrations_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
