-- Program Factory scaffold: phase structure JSON (see root supabase/migrations/20260430107000_programs_program_template.sql).
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS program_template jsonb;

COMMENT ON COLUMN public.programs.program_template IS
  'AI-generated scaffold (phases, totalWeeks). Null for legacy or manually created programs.';
