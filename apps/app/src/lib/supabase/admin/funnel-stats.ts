/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Phase 6: Activation funnel statistics from analytics_events.
 */

import { getSupabaseServer } from '../server';

export interface FunnelStats {
  /** Date range (ISO) */
  from: string;
  to: string;
  /** Raw event counts */
  timer_session_complete: number;
  timer_save_click: number;
  account_land_handoff: number;
  account_signup_complete: number;
  account_login_complete: number;
  account_session_prefill_success: number;
  account_session_prefill_fail: number;
  hub_timer_launch_1: number;
  hub_timer_launch_2: number;
  /** Distinct users (user_id) per event */
  distinct_users_launch_1: number;
  distinct_users_launch_2: number;
  /** By source (properties->>'source') */
  bySource: Record<
    string,
    {
      timer_save_click: number;
      account_land_handoff: number;
      prefill_success: number;
      prefill_fail: number;
    }
  >;
}

const DEFAULT_DAYS = 30;

export async function getFunnelStats(days = DEFAULT_DAYS): Promise<FunnelStats> {
  const supabase = getSupabaseServer();
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();

  const events = [
    'timer_session_complete',
    'timer_save_click',
    'account_land_handoff',
    'account_signup_complete',
    'account_login_complete',
    'account_session_prefill_success',
    'account_session_prefill_fail',
    'hub_timer_launch_1',
    'hub_timer_launch_2',
  ] as const;

  const counts: Record<string, number> = {};
  const distinctLaunch1 = new Set<string>();
  const distinctLaunch2 = new Set<string>();
  const bySource: FunnelStats['bySource'] = {};

  // Parallelize event queries (each is independent). RPC for count(distinct user_id) would
  // avoid row fetch for hub events; parallelization addresses sequential latency for now.
  const eventResults = await Promise.all(
    events.map(async (name) => {
      if (name === 'hub_timer_launch_1' || name === 'hub_timer_launch_2') {
        const { data: rows } = await supabase
          .from('analytics_events')
          .select('user_id')
          .eq('event_name', name)
          .gte('timestamp', fromIso)
          .lte('timestamp', toIso)
          .not('user_id', 'is', null);
        return { name, rows: rows ?? [] };
      }
      const { count } = await supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', name)
        .gte('timestamp', fromIso)
        .lte('timestamp', toIso);
      return { name, count: count ?? 0 };
    })
  );

  for (const r of eventResults) {
    if ('rows' in r) {
      r.rows.forEach((row) => row.user_id && (r.name === 'hub_timer_launch_1' ? distinctLaunch1 : distinctLaunch2).add(row.user_id));
      counts[r.name] = r.rows.length;
    } else {
      counts[r.name] = r.count;
    }
  }

  // By source: timer_save_click, account_land_handoff, prefill
  const { data: handoffRows } = await supabase
    .from('analytics_events')
    .select('event_name, properties')
    .in('event_name', ['timer_save_click', 'account_land_handoff', 'account_session_prefill_success', 'account_session_prefill_fail'])
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso);

  for (const row of handoffRows ?? []) {
    const source = (row.properties as { source?: string })?.source ?? 'unknown';
    if (!bySource[source]) {
      bySource[source] = {
        timer_save_click: 0,
        account_land_handoff: 0,
        prefill_success: 0,
        prefill_fail: 0,
      };
    }
    if (row.event_name === 'timer_save_click') bySource[source].timer_save_click++;
    else if (row.event_name === 'account_land_handoff') bySource[source].account_land_handoff++;
    else if (row.event_name === 'account_session_prefill_success') bySource[source].prefill_success++;
    else if (row.event_name === 'account_session_prefill_fail') bySource[source].prefill_fail++;
  }

  return {
    from: fromIso,
    to: toIso,
    timer_session_complete: counts['timer_session_complete'] ?? 0,
    timer_save_click: counts['timer_save_click'] ?? 0,
    account_land_handoff: counts['account_land_handoff'] ?? 0,
    account_signup_complete: counts['account_signup_complete'] ?? 0,
    account_login_complete: counts['account_login_complete'] ?? 0,
    account_session_prefill_success: counts['account_session_prefill_success'] ?? 0,
    account_session_prefill_fail: counts['account_session_prefill_fail'] ?? 0,
    hub_timer_launch_1: counts['hub_timer_launch_1'] ?? 0,
    hub_timer_launch_2: counts['hub_timer_launch_2'] ?? 0,
    distinct_users_launch_1: distinctLaunch1.size,
    distinct_users_launch_2: distinctLaunch2.size,
    bySource,
  };
}
