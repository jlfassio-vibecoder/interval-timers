-- Align public.amrap_sessions.duration_minutes with trainer_live_attach_amrap_session and create_session.
-- Legacy CHECK only allowed (5, 15, 20); Trainer Live + saved-workout attach use 1–180 minutes.
-- Mirrored from repo root supabase/migrations for environments that apply apps/app migrations only.

ALTER TABLE public.amrap_sessions
  DROP CONSTRAINT IF EXISTS amrap_sessions_duration_minutes_check;

ALTER TABLE public.amrap_sessions
  ADD CONSTRAINT amrap_sessions_duration_minutes_check
  CHECK (duration_minutes >= 1 AND duration_minutes <= 180);
