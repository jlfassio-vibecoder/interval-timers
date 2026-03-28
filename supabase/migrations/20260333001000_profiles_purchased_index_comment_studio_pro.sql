-- Extend purchased_index semantics: Studio Pro as index 5 (distinct list tier). See apps/app/src/data/pricing.ts and analytics-monetization PLAN_METADATA.

COMMENT ON COLUMN public.profiles.purchased_index IS
  'Paid plan tier: 0=Athlete ($9.99), 1=Host ($24.99), 2=Pro ($49.99 list), 3=Studio ($199.99 list), '
  '4=Coach Pro legacy ($199), 5=Studio Pro ($299.99 list; align with Stripe). '
  'Admin estimated MRR uses list price × count; Pro +$1/active client beyond 30 when profile_billing_snapshot.active_client_count is set.';
