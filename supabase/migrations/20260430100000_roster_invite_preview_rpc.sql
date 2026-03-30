-- Public invite preview: inviter profile + studio in one SECURITY DEFINER read.
-- API routes often use only the anon key; RLS blocks SELECT on other users' profiles and on studios,
-- so the preview could not load trainer name/avatar/studio without the service role.

-- Hosted DBs created before baseline alignment may lack columns present in 20250101000000_baseline_public_profiles.sql.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

CREATE OR REPLACE FUNCTION public.get_roster_invite_preview_core(p_token_hash text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'inviter_id', ri.inviter_id,
    'kind', ri.kind,
    'invitee_email', ri.invitee_email,
    'invitee_phone_e164', ri.invitee_phone_e164,
    'full_name', p.full_name,
    'username', p.username,
    'email', p.email,
    'avatar_url', p.avatar_url,
    'studio_id', p.studio_id,
    'studio_slug', st.slug,
    'studio_display_name', st.display_name,
    'studio_logo_url', st.logo_url,
    'studio_primary_color', st.primary_color,
    'studio_welcome_tagline', st.welcome_tagline
  )
  FROM roster_invitations ri
  INNER JOIN profiles p ON p.id = ri.inviter_id
  LEFT JOIN studios st ON st.id = p.studio_id
  WHERE ri.token_hash = p_token_hash
    AND ri.status = 'pending'
    AND ri.expires_at > now()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_roster_invite_preview_core(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_roster_invite_preview_core(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_roster_invite_preview_core(text) IS
  'Returns inviter + studio fields for a valid pending roster invite token hash; used by GET /api/invitations/preview.';
