/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Monetization: paid by plan, trial counts, trial conversion, TTFC, estimated MRR/ARPU/LTV.
 * Tier 1: profiles.purchased_index, trial_ends_at, user_programs (no Stripe).
 * Optional: profile_billing_snapshot.active_client_count for Pro +$1/mo per client beyond 30.
 *
 * HIIT Ecosystem matrix (keep aligned with apps/app/src/data/pricing.ts and DB COMMENT):
 * 0 Athlete, 1 Host, 2 Pro, 3 Studio, 4 Coach Pro (legacy), 5 Studio Pro.
 * Estimated MRR = list-price MRR + Pro overage when snapshot counts exist; otherwise list prices only.
 */

import { getSupabaseServer } from '../server';

/** Inclusive bounds for paid tiers on profiles.purchased_index. */
const PAID_INDEX_MIN = 0;
const PAID_INDEX_MAX = 5;

const PRO_INCLUDED_CLIENTS = 30;
const PRO_OVERAGE_USD_PER_CLIENT = 1;

/** List prices for admin charts; index matches profiles.purchased_index. */
const PLAN_METADATA: { name: string; price: number }[] = [
  { name: 'Athlete', price: 9.99 },
  { name: 'Host', price: 24.99 },
  { name: 'Pro', price: 49.99 },
  { name: 'Studio', price: 199.99 },
  { name: 'Coach Pro (legacy)', price: 199 },
  { name: 'Studio Pro', price: 299.99 },
];

export interface MonetizationStats {
  activeByPlan: { planName: string; planIndex: number; count: number; price: number }[];
  activePaidCount: number;
  activeTrialCount: number;
  trialConversionRate: number;
  trialConverted: number;
  trialEligible: number;
  ttfcDistribution: {
    sameDay: number;
    oneToTwoDays: number;
    threeToSevenDays: number;
    sevenPlusDays: number;
  };
  /** Sum of count × list price per tier (no Pro client overage). */
  listPriceMrr: number;
  /** Extra MRR from Pro subscribers with non-null active_client_count in profile_billing_snapshot. */
  proOverageMrr: number;
  estimatedMrr: number;
  arpu: number;
  ltvHeuristic: number;
}

function isPaidIndex(idx: number | null | undefined): idx is number {
  return idx != null && idx >= PAID_INDEX_MIN && idx <= PAID_INDEX_MAX;
}

export async function getMonetizationStats(days: number): Promise<MonetizationStats> {
  const supabase = getSupabaseServer();
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();
  const nowIso = toDate.toISOString();

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, created_at, trial_ends_at, purchased_index')
    .gte('created_at', fromIso)
    .lte('created_at', toIso);

  const profiles = profileRows ?? [];

  const { data: paidRows } = await supabase
    .from('profiles')
    .select('id, purchased_index')
    .not('purchased_index', 'is', null)
    .gte('purchased_index', PAID_INDEX_MIN)
    .lte('purchased_index', PAID_INDEX_MAX);

  const countByPlanIndex = new Map<number, number>();
  for (const row of paidRows ?? []) {
    const idx = (row as { purchased_index: number }).purchased_index;
    if (isPaidIndex(idx)) {
      countByPlanIndex.set(idx, (countByPlanIndex.get(idx) ?? 0) + 1);
    }
  }

  const activeByPlan = PLAN_METADATA.map((plan, planIndex) => ({
    planName: plan.name,
    planIndex,
    count: countByPlanIndex.get(planIndex) ?? 0,
    price: plan.price,
  }));

  const activePaidCount = paidRows?.length ?? 0;

  const proProfileIds = (paidRows ?? [])
    .filter((row) => (row as { purchased_index: number }).purchased_index === 2)
    .map((row) => (row as { id: string }).id);

  let proOverageMrr = 0;
  if (proProfileIds.length > 0) {
    const { data: snapRows } = await supabase
      .from('profile_billing_snapshot')
      .select('active_client_count')
      .in('profile_id', proProfileIds);

    for (const snap of snapRows ?? []) {
      const n = (snap as { active_client_count: number | null }).active_client_count;
      if (n == null || Number.isNaN(n)) continue;
      proOverageMrr += Math.max(0, n - PRO_INCLUDED_CLIENTS) * PRO_OVERAGE_USD_PER_CLIENT;
    }
  }

  const listPriceMrr = activeByPlan.reduce((sum, p) => sum + p.count * p.price, 0);
  const estimatedMrr = listPriceMrr + proOverageMrr;

  const { count: activeTrialCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gt('trial_ends_at', nowIso)
    .is('purchased_index', null);

  const trialCount = activeTrialCount ?? 0;

  let trialEligible = 0;
  let trialConverted = 0;
  for (const p of profiles) {
    const trialEndsAt = (p as { trial_ends_at?: string | null }).trial_ends_at;
    const created_at = (p as { created_at: string }).created_at;
    if (!created_at) continue;
    const trialEnd = trialEndsAt ? new Date(trialEndsAt).getTime() : null;
    if (trialEnd != null && trialEnd < toDate.getTime()) {
      trialEligible += 1;
      const idx = (p as { purchased_index?: number | null }).purchased_index;
      if (isPaidIndex(idx)) trialConverted += 1;
    }
  }
  const trialConversionRate = trialEligible > 0 ? trialConverted / trialEligible : 0;

  const convertedUserIds = new Set(
    profiles
      .filter((p) => {
        const idx = (p as { purchased_index?: number | null }).purchased_index;
        return isPaidIndex(idx);
      })
      .map((p) => (p as { id: string }).id)
  );

  const createdByUser = new Map<string, number>();
  for (const p of profiles) {
    const id = (p as { id: string }).id;
    const created_at = (p as { created_at: string }).created_at;
    if (created_at) createdByUser.set(id, new Date(created_at).getTime());
  }

  const { data: upRows } = await supabase
    .from('user_programs')
    .select('user_id, purchased_at')
    .eq('source', 'self')
    .not('purchased_at', 'is', null);

  const firstPurchaseByUser = new Map<string, number>();
  for (const row of upRows ?? []) {
    const uid = (row as { user_id: string }).user_id;
    const at = new Date((row as { purchased_at: string }).purchased_at).getTime();
    const existing = firstPurchaseByUser.get(uid);
    if (existing == null || at < existing) firstPurchaseByUser.set(uid, at);
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const ttfcDistribution = {
    sameDay: 0,
    oneToTwoDays: 0,
    threeToSevenDays: 0,
    sevenPlusDays: 0,
  };
  for (const uid of convertedUserIds) {
    const created = createdByUser.get(uid);
    const firstPurchase = firstPurchaseByUser.get(uid);
    if (created == null || firstPurchase == null) continue;
    const deltaDays = (firstPurchase - created) / dayMs;
    if (deltaDays < 1) ttfcDistribution.sameDay += 1;
    else if (deltaDays <= 2) ttfcDistribution.oneToTwoDays += 1;
    else if (deltaDays <= 7) ttfcDistribution.threeToSevenDays += 1;
    else ttfcDistribution.sevenPlusDays += 1;
  }

  const arpu = activePaidCount > 0 ? estimatedMrr / activePaidCount : 0;

  let totalTenureMonths = 0;
  let tenureCount = 0;
  for (const [, firstAt] of firstPurchaseByUser) {
    totalTenureMonths += (toDate.getTime() - firstAt) / (30.44 * dayMs);
    tenureCount += 1;
  }
  const avgLifetimeMonths = tenureCount > 0 ? totalTenureMonths / tenureCount : 3;
  const ltvHeuristic = arpu * Math.max(1, avgLifetimeMonths);

  return {
    activeByPlan,
    activePaidCount,
    activeTrialCount: trialCount,
    trialConversionRate,
    trialConverted,
    trialEligible,
    ttfcDistribution,
    listPriceMrr,
    proOverageMrr,
    estimatedMrr,
    arpu,
    ltvHeuristic,
  };
}
