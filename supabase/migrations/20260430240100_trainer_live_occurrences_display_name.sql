-- P3: Optional trainer-visible title override on scheduled live occurrences (unified calendar).

ALTER TABLE public.trainer_live_session_occurrences
  ADD COLUMN IF NOT EXISTS display_name text NULL;

COMMENT ON COLUMN public.trainer_live_session_occurrences.display_name IS
  'Optional calendar card title; when null, UI shows default Scheduled Live.';
