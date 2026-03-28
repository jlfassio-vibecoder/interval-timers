-- Phase P2 optional billing snapshot: usage/location fields populated by Stripe sync or jobs later.
-- Admin MRR uses list prices from profiles.purchased_index; Pro +$1/active client beyond 30 when active_client_count is set.

CREATE TABLE IF NOT EXISTS public.profile_billing_snapshot (
  profile_id uuid NOT NULL PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NULL,
  stripe_customer_id text NULL,
  active_client_count integer NULL,
  ai_credits_consumed integer NULL,
  studio_location_id text NULL,
  studio_location_count integer NULL
);

CREATE INDEX IF NOT EXISTS profile_billing_snapshot_updated_at_idx
  ON public.profile_billing_snapshot (updated_at DESC);

ALTER TABLE public.profile_billing_snapshot ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.profile_billing_snapshot IS
  'Billing-side metrics per profile; written by server/webhooks/jobs. NULLs mean unknown — admin MRR falls back to list price × tier count.';

COMMENT ON COLUMN public.profile_billing_snapshot.active_client_count IS
  'Reported active roster size for Pro (purchased_index=2); admin adds max(0, count-30)×$1 to estimated MRR when non-NULL.';

COMMENT ON COLUMN public.profile_billing_snapshot.ai_credits_consumed IS
  'Optional usage counter for capped tiers (e.g. Athlete); window defined by the writer (document in job). Analytics KPI only unless overage is sold.';

COMMENT ON COLUMN public.profile_billing_snapshot.studio_location_id IS
  'Canonical location id from billing (e.g. Stripe metadata).';

COMMENT ON COLUMN public.profile_billing_snapshot.studio_location_count IS
  'Optional count for multi-location add-ons; MRR formula TBD when billing defines per-location price.';
