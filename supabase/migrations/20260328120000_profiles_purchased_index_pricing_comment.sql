-- Documents purchased_index semantics for the HIIT Ecosystem pricing matrix (2026).
-- Application code: apps/app/src/data/pricing.ts and analytics-monetization PLAN_METADATA.

COMMENT ON COLUMN public.profiles.purchased_index IS
  'Paid plan tier: 0=Athlete ($9.99), 1=Host ($24.99), 2=Pro ($49.99 list), 3=Studio ($199.99 list). '
  'Index 4 = legacy pre-matrix Coach Pro ($199) until Stripe/webhook reconciliation remaps rows. '
  'Pro tier: estimated MRR in admin uses list price only; +$1/active client beyond 30 is not in DB.';
