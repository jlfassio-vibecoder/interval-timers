-- Phase 5: Reverse Trial Infrastructure
-- 1. Add trial_ends_at as hub-wide single source of truth
-- 2. Add activation columns for first/second timer launch tracking
-- 3. Create log_hub_timer_activation RPC

-- Profiles: trial_ends_at (hub-wide)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Backfill from amrap_trial_ends_at
UPDATE public.profiles
SET trial_ends_at = amrap_trial_ends_at
WHERE trial_ends_at IS NULL AND amrap_trial_ends_at IS NOT NULL;

-- Profiles: activation tracking columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activation_first_timer_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activation_second_timer_at timestamptz;

-- Update trigger: set both trial_ends_at and amrap_trial_ends_at on new profile
CREATE OR REPLACE FUNCTION public.set_amrap_trial_on_profile_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amrap_trial_ends_at IS NULL THEN
    NEW.amrap_trial_ends_at := now() + interval '7 days';
  END IF;
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_amrap_trial_on_profile_insert ON public.profiles;
CREATE TRIGGER set_amrap_trial_on_profile_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_amrap_trial_on_profile_insert();

-- RPC: log hub timer activation (first and second within 48h)
CREATE OR REPLACE FUNCTION public.log_hub_timer_activation(p_app_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_first timestamptz;
  v_second timestamptz;
  v_now timestamptz := now();
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT activation_first_timer_at, activation_second_timer_at
  INTO v_first, v_second
  FROM public.profiles
  WHERE id = v_uid
  FOR UPDATE;

  IF v_first IS NULL THEN
    UPDATE public.profiles
    SET activation_first_timer_at = v_now
    WHERE id = v_uid;
    RETURN;
  END IF;

  IF v_second IS NULL AND (v_now - v_first) <= interval '48 hours' THEN
    UPDATE public.profiles
    SET activation_second_timer_at = v_now
    WHERE id = v_uid;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_hub_timer_activation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_hub_timer_activation(text) TO authenticated;
