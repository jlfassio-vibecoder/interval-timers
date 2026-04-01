-- Program Factory / admin UI: columns expected by program-server and program-persistence.
-- Baseline 20250102000000 did not include these; some environments added them ad hoc.
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS duration_weeks integer DEFAULT 4;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS featured_on_landing boolean DEFAULT false;

COMMENT ON COLUMN public.programs.duration_weeks IS 'Planned length in weeks (scaffold totalWeeks, editor).';
COMMENT ON COLUMN public.programs.featured_on_landing IS 'Homepage spotlight flag for published programs.';
