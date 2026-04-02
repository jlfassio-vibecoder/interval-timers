-- Client HUD: resolve coach display for an enrolled program without broad profiles SELECT.
-- SECURITY DEFINER reads profiles + trainers server-side; RLS stays tight on direct client reads.

CREATE OR REPLACE FUNCTION public.get_trainer_profile_for_client(p_program_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  tr_display text;
  tr_logo text;
  p_full text;
  p_user text;
  p_email text;
  p_avatar text;
  disp text;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_programs up
    WHERE
      up.user_id = uid
      AND up.program_id = p_program_id
      AND up.status = 'active'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT p.trainer_id INTO tid FROM public.programs p WHERE p.id = p_program_id;
  IF tid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT t.display_name, t.logo_url INTO tr_display, tr_logo
  FROM public.trainers t
  WHERE t.user_id = tid;

  SELECT pr.full_name, pr.username, pr.email, pr.avatar_url
  INTO p_full, p_user, p_email, p_avatar
  FROM public.profiles pr
  WHERE pr.id = tid;

  IF p_full IS NULL AND p_user IS NULL AND p_email IS NULL AND tr_display IS NULL THEN
    RETURN NULL;
  END IF;

  disp := NULL;
  IF tr_display IS NOT NULL AND trim(tr_display) <> '' THEN
    disp := trim(tr_display);
  ELSIF p_full IS NOT NULL AND trim(p_full) <> '' THEN
    disp := trim(p_full);
  ELSIF p_user IS NOT NULL AND trim(p_user) <> '' THEN
    disp := trim(p_user);
  ELSIF p_email IS NOT NULL AND trim(p_email) <> '' THEN
    disp := trim(split_part(p_email, '@', 1));
  ELSE
    disp := 'Coach';
  END IF;

  RETURN jsonb_build_object(
    'trainer_user_id',
    tid,
    'display_name',
    disp,
    'avatar_url',
    COALESCE(NULLIF(trim(COALESCE(tr_logo, '')), ''), p_avatar)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_trainer_profile_for_client(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trainer_profile_for_client(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_trainer_profile_for_client(uuid) IS
  'Returns safe coach display fields for auth.uid() when actively enrolled in p_program_id.';
