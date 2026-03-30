-- Public invite preview: inviter profile + studio in one SECURITY DEFINER read.
-- API routes often use only the anon key; RLS blocks SELECT on other users' profiles and on studios,
-- so the preview could not load trainer name/avatar/studio without the service role.
-- RPC is granted to anon/authenticated: omit raw inviter email, NULL invitee contact unless kind=client.

-- Hosted DBs created before baseline alignment may lack columns present in 20250101000000_baseline_public_profiles.sql.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

CREATE OR REPLACE FUNCTION public.get_roster_invite_preview_core(p_token_hash text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
  SELECT jsonb_build_object(
    'inviter_id', ri.inviter_id,
    'kind', ri.kind,
    'invitee_email', CASE WHEN ri.kind = 'client' THEN ri.invitee_email ELSE NULL END,
    'invitee_phone_e164', CASE WHEN ri.kind = 'client' THEN ri.invitee_phone_e164 ELSE NULL END,
    'full_name', p.full_name,
    'username', p.username,
    -- Mirrors apps resolveInviterDisplayName (email local-part fallback) without exposing p.email in JSON.
    'inviter_display_label', (
      COALESCE(
        NULLIF(trim(both from COALESCE(p.full_name, '')), ''),
        NULLIF(trim(both from COALESCE(p.username, '')), ''),
        NULLIF(
          trim(both from regexp_replace(
            regexp_replace(split_part(trim(both from COALESCE(p.email, '')), '@', 1), '[._-]+', ' ', 'g'),
            '\s+', ' ', 'g'
          )),
          ''
        )
      )
    ),
    'avatar_url', p.avatar_url,
    'studio_id', p.studio_id,
    'studio_slug', st.slug,
    'studio_display_name', st.display_name,
    'studio_logo_url', st.logo_url,
    'studio_primary_color', st.primary_color,
    'studio_welcome_tagline', st.welcome_tagline
  )
  FROM public.roster_invitations ri
  INNER JOIN public.profiles p ON p.id = ri.inviter_id
  LEFT JOIN public.studios st ON st.id = p.studio_id
  WHERE ri.token_hash = p_token_hash
    AND ri.status = 'pending'
    AND ri.expires_at > now()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_roster_invite_preview_core(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_roster_invite_preview_core(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_roster_invite_preview_core(text) IS
  'Returns inviter + studio fields for a valid pending roster invite token hash; used by GET /api/invitations/preview.';
