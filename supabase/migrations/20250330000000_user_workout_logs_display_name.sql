-- Add optional display name for user_workout_logs (e.g. pasted workouts from Universal Activity Hub).
-- Training Log uses this when set instead of formatProgramSessionWorkoutName(week_id, workout_id).

ALTER TABLE public.user_workout_logs
  ADD COLUMN IF NOT EXISTS workout_display_name text;

COMMENT ON COLUMN public.user_workout_logs.workout_display_name IS 'Human-readable label for Training Log; used when program_id = universal_activity_hub or similar ad-hoc sources.';
