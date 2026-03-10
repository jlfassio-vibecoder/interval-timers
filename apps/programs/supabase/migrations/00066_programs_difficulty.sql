-- Add difficulty column if missing (e.g. programs table existed before 00001).
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'intermediate';
