-- Add source column to user_programs for gating B2C upgrade prompts (Phase 0).
-- Non-breaking: existing rows get default 'self'. NOT NULL so client logic is consistent.
ALTER TABLE public.user_programs
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'self'
    CHECK (source IN ('self', 'trainer_assigned', 'cohort'));

-- Backfill any NULLs (e.g. column existed before default, or manual updates).
UPDATE public.user_programs SET source = 'self' WHERE source IS NULL;

-- Enforce NOT NULL so rows are never treated inconsistently in the client.
ALTER TABLE public.user_programs
  ALTER COLUMN source SET NOT NULL;
