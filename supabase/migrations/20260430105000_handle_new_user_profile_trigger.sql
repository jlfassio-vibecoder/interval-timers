-- Ensure every new auth.users row gets public.profiles (roster_invitations.accepted_user_id +
-- host_friend_connections reference profiles.id). Hosted DBs that only applied repo-root migrations
-- may have lacked the apps/app trigger; invites then failed with PostgREST 409 on finalize PATCH.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r text;
BEGIN
  r := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  IF r NOT IN ('client', 'host', 'admin', 'super_admin') THEN
    r := 'client';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    r
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user() IS
  'Syncs public.profiles on signup; required for roster invitation FKs (accepted_user_id, host_friend_connections).';
