-- Phase 6: Extend log_hub_timer_activation to return milestone for analytics events
-- Must DROP first: PostgreSQL cannot change return type (void -> text) via CREATE OR REPLACE

DROP FUNCTION IF EXISTS public.log_hub_timer_activation(text);

CREATE FUNCTION public.log_hub_timer_activation(p_app_id text)
RETURNS text
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
    RETURN NULL;
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
    RETURN 'first';
  END IF;

  IF v_second IS NULL AND (v_now - v_first) <= interval '48 hours' THEN
    UPDATE public.profiles
    SET activation_second_timer_at = v_now
    WHERE id = v_uid;
    RETURN 'second';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_hub_timer_activation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_hub_timer_activation(text) TO authenticated;
