-- Studio branding for invite landing (Phase 3). RLS: no client policies; service role + preview API only.

CREATE TABLE IF NOT EXISTS public.studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  display_name text NOT NULL,
  logo_url text,
  primary_color text,
  welcome_tagline text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studios_slug_format CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  CONSTRAINT studios_slug_reserved CHECK (
    slug NOT IN ('www', 'api', 'app', 'account', 'trainer', 'welcome', 'verify', 's')
  ),
  CONSTRAINT studios_primary_color_format CHECK (
    primary_color IS NULL
    OR primary_color ~ '^#[0-9A-Fa-f]{3}$'
    OR primary_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS studios_slug_key ON public.studios (slug);

COMMENT ON TABLE public.studios IS 'Trainer/studio brand for roster invite landing; read for invitees via service-role preview API only.';
COMMENT ON COLUMN public.studios.slug IS 'URL segment for /s/{slug}/i/{token}; lowercase alphanumeric and hyphens.';
COMMENT ON COLUMN public.studios.primary_color IS 'Optional hex color #rgb or #rrggbb for welcome landing accent.';

ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon/authenticated: clients use hub APIs with service role.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS studio_id uuid REFERENCES public.studios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_studio_id_idx ON public.profiles (studio_id) WHERE studio_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.studio_id IS 'Optional studio brand for trainers; assign via SQL or admin tooling (v1).';
