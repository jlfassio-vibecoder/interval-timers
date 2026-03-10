-- Extend generated_wods to match app shape (GeneratedWODDoc / SerializedGeneratedWOD).
-- Existing: id, title, level, workout_detail, author_id, created_at, updated_at.
-- Add: status, name, genre, image, day, description, intensity, and optional fields.

ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved'));
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS name text DEFAULT '';
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS genre text DEFAULT '';
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS image text DEFAULT '';
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS day text DEFAULT 'WOD';
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS intensity integer NOT NULL DEFAULT 3;
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS exercise_overrides jsonb;
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS iteration jsonb;
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS parameters jsonb;
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS resolved_format jsonb;
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS target_volume_minutes integer;
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS window_minutes integer;
ALTER TABLE public.generated_wods ADD COLUMN IF NOT EXISTS rest_load text;

CREATE INDEX IF NOT EXISTS idx_generated_wods_status_created
  ON public.generated_wods(status, created_at DESC);
