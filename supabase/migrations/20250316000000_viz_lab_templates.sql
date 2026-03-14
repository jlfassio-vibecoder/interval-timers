-- Viz Lab templates: team-shared form presets for Exercise Image Generator
-- Idempotent: safe to run again.

CREATE TABLE IF NOT EXISTS public.viz_lab_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  config jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viz_lab_templates_created_at
  ON public.viz_lab_templates(created_at DESC);

ALTER TABLE public.viz_lab_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read viz_lab_templates" ON public.viz_lab_templates;
DROP POLICY IF EXISTS "Authenticated can manage viz_lab_templates" ON public.viz_lab_templates;
CREATE POLICY "Authenticated can read viz_lab_templates" ON public.viz_lab_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can manage viz_lab_templates" ON public.viz_lab_templates
  FOR ALL USING (auth.uid() IS NOT NULL);
