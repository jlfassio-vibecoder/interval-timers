-- Optional Phase 3 extension: per-goal metadata (notes, timestamps, etc.)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fitness_goal_metadata jsonb NULL;
