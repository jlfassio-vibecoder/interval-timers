-- Program Factory scaffold flow: phase structure JSON before program_weeks rows exist.
-- Required for generate-scaffold, PUT/GET /api/admin/programs/:id/scaffold, and updateProgramScaffold.
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS program_template jsonb;

COMMENT ON COLUMN public.programs.program_template IS
  'AI-generated scaffold (phases, totalWeeks). Null for legacy or manually created programs.';
