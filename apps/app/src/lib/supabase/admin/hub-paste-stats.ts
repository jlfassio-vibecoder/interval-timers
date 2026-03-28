/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Universal Activity Hub (paste) engagement from analytics_events.
 * Events ingested via POST /api/analytics/hub-funnel with app_id universal_activity_hub.
 */

import { warnIfAdminAnalyticsRowCapHit } from '@/lib/admin/admin-analytics-cap-warn';
import { getSupabaseServer } from '../server';

export const HUB_PASTE_APP_ID = 'universal_activity_hub';

const HUB_PASTE_EVENTS = [
  'hub_parse_success',
  'hub_parse_fail',
  'hub_action_click',
  'hub_handoff_post_ok',
  'hub_handoff_post_fail',
] as const;

/** Max rows read for distinct session_id; if result length equals this, count may be truncated. */
export const HUB_PASTE_SESSION_FETCH_LIMIT = 50_000;

/** Max rows for property aggregation (action / handoff kind). */
const HUB_PASTE_PROPERTY_FETCH_LIMIT = 50_000;

export interface HubPasteStats {
  from: string;
  to: string;
  hub_parse_success: number;
  hub_parse_fail: number;
  /**
   * Distinct session_id on any paste-funnel event.
   * If `distinctSessionsCapped` is true, more sessions may exist beyond the fetch limit.
   */
  distinctSessionCount: number;
  distinctSessionsCapped: boolean;
  /** hub_action_click: counts by properties.action */
  actionClicks: Record<string, number>;
  /** hub_handoff_post_ok: counts by properties.kind */
  handoffOkByKind: Record<string, number>;
  /** hub_handoff_post_fail: counts by properties.kind */
  handoffFailByKind: Record<string, number>;
}

function clampDays(days: number): number {
  return Math.min(90, Math.max(1, days));
}

export async function getHubPasteStats(daysInput: number): Promise<HubPasteStats> {
  const days = clampDays(daysInput);
  const supabase = getSupabaseServer();
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();

  const countQueries = HUB_PASTE_EVENTS.map((eventName) =>
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('app_id', HUB_PASTE_APP_ID)
      .eq('event_name', eventName)
      .gte('timestamp', fromIso)
      .lte('timestamp', toIso)
  );

  const sessionQuery = supabase
    .from('analytics_events')
    .select('session_id')
    .eq('app_id', HUB_PASTE_APP_ID)
    .in('event_name', [...HUB_PASTE_EVENTS])
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .not('session_id', 'is', null)
    .limit(HUB_PASTE_SESSION_FETCH_LIMIT);

  const actionPropsQuery = supabase
    .from('analytics_events')
    .select('properties')
    .eq('app_id', HUB_PASTE_APP_ID)
    .eq('event_name', 'hub_action_click')
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .limit(HUB_PASTE_PROPERTY_FETCH_LIMIT);

  const handoffPropsQuery = supabase
    .from('analytics_events')
    .select('event_name, properties')
    .eq('app_id', HUB_PASTE_APP_ID)
    .in('event_name', ['hub_handoff_post_ok', 'hub_handoff_post_fail'])
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .limit(HUB_PASTE_PROPERTY_FETCH_LIMIT);

  const [countResults, sessionResult, actionResult, handoffResult] = await Promise.all([
    Promise.all(countQueries.map((q) => q)),
    sessionQuery,
    actionPropsQuery,
    handoffPropsQuery,
  ]);

  const counts: Record<string, number> = {};
  HUB_PASTE_EVENTS.forEach((name, i) => {
    counts[name] = countResults[i].count ?? 0;
  });

  const sessionRows = sessionResult.data ?? [];
  warnIfAdminAnalyticsRowCapHit(
    'hub-paste distinct sessions',
    sessionRows.length,
    HUB_PASTE_SESSION_FETCH_LIMIT
  );
  const distinctSessions = new Set(sessionRows.map((r) => r.session_id as string).filter(Boolean));
  const distinctSessionsCapped = sessionRows.length >= HUB_PASTE_SESSION_FETCH_LIMIT;

  const actionRows = actionResult.data ?? [];
  warnIfAdminAnalyticsRowCapHit(
    'hub-paste hub_action_click properties',
    actionRows.length,
    HUB_PASTE_PROPERTY_FETCH_LIMIT
  );
  const actionClicks: Record<string, number> = {};
  for (const row of actionRows) {
    const action = (row.properties as { action?: string })?.action ?? 'unknown';
    actionClicks[action] = (actionClicks[action] ?? 0) + 1;
  }

  const handoffOkByKind: Record<string, number> = {};
  const handoffFailByKind: Record<string, number> = {};
  const handoffRows = handoffResult.data ?? [];
  warnIfAdminAnalyticsRowCapHit(
    'hub-paste handoff properties',
    handoffRows.length,
    HUB_PASTE_PROPERTY_FETCH_LIMIT
  );
  for (const row of handoffRows) {
    const kind = (row.properties as { kind?: string })?.kind ?? 'unknown';
    if (row.event_name === 'hub_handoff_post_ok') {
      handoffOkByKind[kind] = (handoffOkByKind[kind] ?? 0) + 1;
    } else {
      handoffFailByKind[kind] = (handoffFailByKind[kind] ?? 0) + 1;
    }
  }

  return {
    from: fromIso,
    to: toIso,
    hub_parse_success: counts['hub_parse_success'] ?? 0,
    hub_parse_fail: counts['hub_parse_fail'] ?? 0,
    distinctSessionCount: distinctSessions.size,
    distinctSessionsCapped,
    actionClicks,
    handoffOkByKind,
    handoffFailByKind,
  };
}
