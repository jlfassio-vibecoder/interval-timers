-- Coach identity + branding (parallel to studios). Profiles stay athlete-oriented; Mission Control coaches
-- are recognized via this table, not profiles.role = 'trainer'.

CREATE TABLE IF NOT EXISTS public.trainers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  slug text,
  display_name text NOT NULL,
  logo_url text,
  primary_color text,
  welcome_tagline text,
  welcome_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  studio_id uuid REFERENCES public.studios (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trainers_slug_format CHECK (
    slug IS NULL
    OR slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'
  ),
  CONSTRAINT trainers_slug_reserved CHECK (
    slug IS NULL
    OR slug NOT IN ('www', 'api', 'app', 'account', 'trainer', 'welcome', 'verify', 's')
  ),
  CONSTRAINT trainers_primary_color_format CHECK (
    primary_color IS NULL
    OR primary_color ~ '^#[0-9A-Fa-f]{3}$'
    OR primary_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS trainers_slug_key ON public.trainers (slug)
WHERE
  slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS trainers_studio_id_idx ON public.trainers (studio_id)
WHERE
  studio_id IS NOT NULL;

COMMENT ON TABLE public.trainers IS 'Coach row (1:1 with profile); branding and welcome copy; studio_id links org brand.';

COMMENT ON COLUMN public.trainers.studio_id IS 'Optional studio org brand; migrated from profiles.studio_id for coaches.';

-- Backfill from legacy trainer role; copy org link from profile.
INSERT INTO
  public.trainers (
    user_id,
    display_name,
    logo_url,
    primary_color,
    welcome_tagline,
    studio_id
  )
SELECT
  p.id,
  COALESCE(
    NULLIF(trim(both FROM COALESCE(p.full_name, '')), ''),
    NULLIF(trim(both FROM COALESCE(p.username, '')), ''),
    'Coach'
  ),
  NULLIF(trim(both FROM COALESCE(p.avatar_url, '')), ''),
  NULL,
  NULL,
  p.studio_id
FROM
  public.profiles p
WHERE
  p.role = 'trainer'
ON CONFLICT (user_id) DO NOTHING;

-- Deterministic public slug for invite URLs when the coach has no studio slug (studios.slug remains preferred when linked).
UPDATE public.trainers t
SET
  slug = 'c-' || replace(t.user_id::text, '-', '')
WHERE
  t.slug IS NULL;

-- Athlete-oriented profile: coaches no longer use profiles.role or profiles.studio_id for org brand.
UPDATE public.profiles p
SET
  role = 'client',
  studio_id = NULL
WHERE
  EXISTS (
    SELECT
      1
    FROM
      public.trainers t
    WHERE
      t.user_id = p.id
  );

-- Mission Control: staff roles on profile OR coach row.
CREATE OR REPLACE FUNCTION public.is_mission_control_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    COALESCE(
      (
        SELECT
          role
        FROM
          public.profiles
        WHERE
          id = auth.uid ()
      ),
      'client'
    ) IN ('host', 'admin', 'super_admin')
    OR EXISTS (
      SELECT
        1
      FROM
        public.trainers t
      WHERE
        t.user_id = auth.uid ()
    );
$$;

ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainers_select_own" ON public.trainers;

CREATE POLICY "trainers_select_own" ON public.trainers FOR
SELECT
  TO authenticated USING (user_id = auth.uid ());

-- Invite preview: join coach row + studio (studio from trainers.studio_id, legacy profiles.studio_id).
CREATE OR REPLACE FUNCTION public.get_roster_invite_preview_core(p_token_hash text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
  SELECT
    jsonb_build_object(
      'inviter_id',
      ri.inviter_id,
      'kind',
      ri.kind,
      'invitee_email',
      CASE
        WHEN ri.kind = 'client' THEN ri.invitee_email
        ELSE NULL
      END,
      'invitee_phone_e164',
      CASE
        WHEN ri.kind = 'client' THEN ri.invitee_phone_e164
        ELSE NULL
      END,
      'full_name',
      p.full_name,
      'username',
      p.username,
      'inviter_display_label',
      (
        COALESCE(
          NULLIF(trim(both FROM COALESCE(p.full_name, '')), ''),
          NULLIF(trim(both FROM COALESCE(p.username, '')), ''),
          NULLIF(
            trim(
              both
              FROM
                regexp_replace(
                  regexp_replace(
                    split_part(trim(both FROM COALESCE(p.email, '')), '@', 1),
                    '[._-]+',
                    ' ',
                    'g'
                  ),
                  '\s+',
                  ' ',
                  'g'
                )
            ),
            ''
          )
        )
      ),
      'avatar_url',
      p.avatar_url,
      'studio_id',
      COALESCE(t.studio_id, p.studio_id),
      'trainer_slug',
      t.slug,
      'trainer_display_name',
      t.display_name,
      'trainer_logo_url',
      t.logo_url,
      'trainer_primary_color',
      t.primary_color,
      'trainer_welcome_tagline',
      t.welcome_tagline,
      'trainer_welcome_content',
      COALESCE(t.welcome_content, '{}'::jsonb),
      'studio_slug',
      st.slug,
      'studio_display_name',
      st.display_name,
      'studio_logo_url',
      st.logo_url,
      'studio_primary_color',
      st.primary_color,
      'studio_welcome_tagline',
      st.welcome_tagline,
      'studio_welcome_content',
      COALESCE(st.welcome_content, '{}'::jsonb)
    )
  FROM
    public.roster_invitations ri
    INNER JOIN public.profiles p ON p.id = ri.inviter_id
    LEFT JOIN public.trainers t ON t.user_id = ri.inviter_id
    LEFT JOIN public.studios st ON st.id = COALESCE(t.studio_id, p.studio_id)
  WHERE
    ri.token_hash = p_token_hash
    AND ri.status = 'pending'
    AND ri.expires_at > now()
  LIMIT
    1;
$$;

COMMENT ON FUNCTION public.get_roster_invite_preview_core(text) IS
  'Returns inviter, trainer row, studio brand, and welcome_content layers for a valid pending roster invite token hash.';

-- Coach rows no longer use profiles.role = 'trainer' (use public.trainers).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check CHECK (
  role IN ('client', 'host', 'admin', 'super_admin')
);

GRANT EXECUTE ON FUNCTION public.is_mission_control_staff() TO authenticated;

GRANT EXECUTE ON FUNCTION public.is_mission_control_staff() TO anon;
