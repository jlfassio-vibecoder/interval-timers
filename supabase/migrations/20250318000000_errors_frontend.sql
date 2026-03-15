-- Phase 6: Quality analytics — frontend error collection.
-- Clients report errors via POST; admin quality API uses service role.

CREATE TABLE IF NOT EXISTS public.errors_frontend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  stack text,
  page text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  properties jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_errors_frontend_occurred_at
  ON public.errors_frontend (occurred_at);

CREATE INDEX IF NOT EXISTS idx_errors_frontend_page_occurred_at
  ON public.errors_frontend (page, occurred_at);

-- RLS: allow INSERT for anon and authenticated; no SELECT for non-service-role
ALTER TABLE public.errors_frontend ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS errors_frontend_insert_anon ON public.errors_frontend;
CREATE POLICY errors_frontend_insert_anon
  ON public.errors_frontend
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS errors_frontend_insert_authenticated ON public.errors_frontend;
CREATE POLICY errors_frontend_insert_authenticated
  ON public.errors_frontend
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
