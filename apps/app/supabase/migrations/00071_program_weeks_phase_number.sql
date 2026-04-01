-- See root supabase/migrations/20260430108000_program_weeks_phase_number.sql
ALTER TABLE public.program_weeks ADD COLUMN IF NOT EXISTS phase_number integer;

COMMENT ON COLUMN public.program_weeks.phase_number IS
  'Phase index from scaffold. Null for legacy rows.';
