-- Admin Program Library: homepage spotlight (see root 20260430109000_programs_duration_weeks_featured_landing.sql).
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS featured_on_landing boolean DEFAULT false;
