-- Add readiness_score to workout_logs for Zone 3 Readiness Check-In (Phase 0).
-- Readiness rows use workout_name='Readiness', effort=1, rating=1.
ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS readiness_score smallint
    CHECK (readiness_score IS NULL OR (readiness_score BETWEEN 1 AND 5));
