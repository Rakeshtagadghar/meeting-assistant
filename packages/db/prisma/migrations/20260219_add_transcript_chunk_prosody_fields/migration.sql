ALTER TABLE "transcript_chunks"
  ADD COLUMN IF NOT EXISTS "prosody_energy" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "prosody_pause_ratio" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "prosody_voiced_ms" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "prosody_snr_db" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "prosody_quality_pass" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "prosody_tone_weights_enabled" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "prosody_confidence_penalty" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "prosody_client_energy" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "prosody_client_stress" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "prosody_client_certainty" DOUBLE PRECISION;
