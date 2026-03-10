-- Add config and chain_metadata to programs for AI-generated program migration (Firestore parity).
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS config jsonb;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS chain_metadata jsonb;
