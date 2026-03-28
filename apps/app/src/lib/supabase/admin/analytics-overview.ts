/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Analytics overview: total events and distinct users in a date range from analytics_events.
 * Uses get_admin_analytics_overview RPC (exact distinct users; no row cap).
 */

import { getSupabaseServer } from '../server';

export interface AnalyticsOverviewResult {
  from: string;
  to: string;
  totalEvents: number;
  distinctUsers: number;
}

function asIsoString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  return String(v ?? '');
}

export async function getAnalyticsOverview(days: number): Promise<AnalyticsOverviewResult> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc('get_admin_analytics_overview', {
    p_days: days,
  });
  if (error) throw error;

  const row = data as {
    from?: unknown;
    to?: unknown;
    total_events?: unknown;
    distinct_users?: unknown;
  } | null;

  if (!row || typeof row !== 'object') {
    throw new Error('get_admin_analytics_overview: invalid response');
  }

  return {
    from: asIsoString(row.from),
    to: asIsoString(row.to),
    totalEvents: Number(row.total_events ?? 0),
    distinctUsers: Number(row.distinct_users ?? 0),
  };
}
