/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Analytics overview: total events and distinct users in a date range from analytics_events.
 */

import { getSupabaseServer } from '../server';

export interface AnalyticsOverviewResult {
  from: string;
  to: string;
  totalEvents: number;
  distinctUsers: number;
}

export async function getAnalyticsOverview(days: number): Promise<AnalyticsOverviewResult> {
  const supabase = getSupabaseServer();
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();

  const { count: totalEvents, error: countError } = await supabase
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso);

  if (countError) throw countError;

  const { data: userRows, error: userError } = await supabase
    .from('analytics_events')
    .select('user_id')
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .not('user_id', 'is', null)
    .limit(50000);

  if (userError) throw userError;

  const distinctUserIds = new Set((userRows ?? []).map((r) => r.user_id as string).filter(Boolean));

  return {
    from: fromIso,
    to: toIso,
    totalEvents: totalEvents ?? 0,
    distinctUsers: distinctUserIds.size,
  };
}
