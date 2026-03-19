-- Training Log Phase 6: weekly goal minutes per user
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_goal_minutes integer DEFAULT 150;

COMMENT ON COLUMN public.profiles.weekly_goal_minutes IS 'Training Log: target minutes per week (Mon–Sun)';
