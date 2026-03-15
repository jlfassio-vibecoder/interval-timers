/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Monetization: paid by plan, trial counts, trial conversion, TTFC, estimated MRR/ARPU/LTV.
 * Tier 1: profiles.purchased_index, trial_ends_at, user_programs (no Stripe).
 */

import { getSupabaseServer } from '../server';

/** Plan names and monthly prices; index matches profiles.purchased_index (0-4). */
const PLAN_METADATA: { name: string; price: number }[] = [
  { name: 'Premium', price: 11.99 },
  { name: 'Pro', price: 19 },
  { name: 'Elite', price: 49 },
  { name: 'Coach', price: 99 },
  { name: 'Coach Pro', price: 199 },
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
  estimatedMrr: number;
  arpu: number;
  ltvHeuristic: number;
}

export async function getMonetizationStats(days: number): Promise<MonetizationStats> {
  const supabase = getSupabaseServer();
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();
  const nowIso = toDate.toISOString();

  // All profiles in range (for trial-eligible we need signups in range whose trial ended)
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, created_at, trial_ends_at, purchased_index')
    .gte('created_at', fromIso)
    .lte('created_at', toIso);

  const profiles = profileRows ?? [];

  // Active paid by plan: all profiles with purchased_index 0-4 (not limited to date range)
  const { data: paidRows } = await supabase
    .from('profiles')
    .select('purchased_index')
    .not('purchased_index', 'is', null)
    .gte('purchased_index', 0)
    .lte('purchased_index', 4);

  const countByPlanIndex = new Map<number, number>();
  for (const row of paidRows ?? []) {
    const idx = (row as { purchased_index: number }).purchased_index;
    if (idx >= 0 && idx <= 4) {
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

  // Active trial: trial_ends_at > now and purchased_index IS NULL (any profile)
  const { count: activeTrialCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gt('trial_ends_at', nowIso)
    .is('purchased_index', null);

  const trialCount = activeTrialCount ?? 0;

  // Trial conversion: signups in range whose trial ended (trial_ends_at < now), converted = purchased_index set
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
      if (idx != null && idx >= 0 && idx <= 4) trialConverted += 1;
    }
  }
  const trialConversionRate = trialEligible > 0 ? trialConverted / trialEligible : 0;

  // TTFC: converted users (with purchased_index), first user_programs.purchased_at where source='self' minus created_at
  const convertedUserIds = new Set(
    profiles
      .filter((p) => {
        const idx = (p as { purchased_index?: number | null }).purchased_index;
        return idx != null && idx >= 0 && idx <= 4;
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

  const estimatedMrr = activeByPlan.reduce((sum, p) => sum + p.count * p.price, 0);
  const arpu = activePaidCount > 0 ? estimatedMrr / activePaidCount : 0;

  // LTV: ARPU × avg lifetime months; approximate from user_programs.purchased_at to now
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
    estimatedMrr,
    arpu,
    ltvHeuristic,
  };
}
