-- Program Factory scaffold / build-phase: program_weeks.phase_number (upsertPhaseWeeks in program-server.ts).
-- Applied on hosted project via MCP; file kept in repo so `supabase db push` / migration history match.
ALTER TABLE public.program_weeks ADD COLUMN IF NOT EXISTS phase_number integer;

COMMENT ON COLUMN public.program_weeks.phase_number IS
  'Phase index from scaffold. Null for legacy rows.';
