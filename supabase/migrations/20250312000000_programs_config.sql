-- Add config and chain_metadata to programs for AI-generated program migration.
-- Fixes: column programs.config does not exist (getPublishedPrograms / program-service).
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS config jsonb;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS chain_metadata jsonb;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'intermediate';
