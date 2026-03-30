-- Per-studio overrides for roster invite landing + welcome-back copy (JSON; validated in app).
ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS welcome_content jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.studios.welcome_content IS
  'Trainer-editable landing copy (pre-sign-in, post-accept, welcome-back) by locale; public subset exposed via invite preview RPC.';

-- Extend invite preview RPC with studio welcome_content (same visibility as other studio brand fields).
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
    'studio_welcome_tagline', st.welcome_tagline,
    'studio_welcome_content', COALESCE(st.welcome_content, '{}'::jsonb)
  )
  FROM public.roster_invitations ri
  INNER JOIN public.profiles p ON p.id = ri.inviter_id
  LEFT JOIN public.studios st ON st.id = p.studio_id
  WHERE ri.token_hash = p_token_hash
    AND ri.status = 'pending'
    AND ri.expires_at > now()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_roster_invite_preview_core(text) IS
  'Returns inviter + studio fields + welcome_content for a valid pending roster invite token hash; used by GET /api/invitations/preview.';
