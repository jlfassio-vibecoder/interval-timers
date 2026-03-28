/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Engagement: DAU/WAU/MAU, stickiness, sessions, feature activity (P4), power-user distribution.
 * Phase P6: DAU/session/trends via RPCs (exact aggregates).
 */

import { warnIfAdminAnalyticsRowCapHit } from '@/lib/admin/admin-analytics-cap-warn';
import {
  FEATURE_ACTIVITY_CATALOG,
  KNOWN_ANALYTICS_APP_IDS,
  POWER_USER_EVENT_NAMES,
  allCatalogEventNames,
  eventNameToFeatureId,
} from '@/lib/admin/feature-activity-catalog';
import { getSupabaseServer } from '../server';

export interface EngagementStats {
  dauByDay: { date: string; count: number }[];
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  sessionCount: number;
  avgSessionDurationMinutes: number;
  avgPagesPerSession: number;
  featureActivity: {
    featureId: string;
    name: string;
    surface: string;
    count7d: number;
    count30d: number;
    wowPercent: number | null;
  }[];
  featureActivityTrends: { featureId: string; points: { date: string; count: number }[] }[];
  /** Last 7d event row counts by known `app_id` plus unset (not exhaustive). */
  eventVolumeByAppId7d: { appId: string; count7d: number }[];
  powerUserDistribution: { bucket: string; count: number }[];
}

const POWER_USER_FETCH_LIMIT = 10_000;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getEngagementStats(days: number): Promise<EngagementStats> {
  const supabase = getSupabaseServer();
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();

  const sevenDaysAgo = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(toDate.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from7 = dateKey(sevenDaysAgo);
  const from14 = dateKey(fourteenDaysAgo);
  const from30 = dateKey(thirtyDaysAgo);

  const trendDayCount = Math.min(Math.max(days, 1), 14);
  const catalogEvents = allCatalogEventNames();

  const [
    { data: dauData, error: dauErr },
    { data: sessionData, error: sessionErr },
    { data: featureDailyData, error: featureDailyErr },
  ] = await Promise.all([
    supabase.rpc('get_engagement_dau_series', { p_days: days }),
    supabase.rpc('get_engagement_web_session_stats', { p_days: days }),
    supabase.rpc('get_feature_activity_daily', {
      p_days: days,
      p_max_days: trendDayCount,
      p_event_names: catalogEvents,
    }),
  ]);

  if (dauErr) throw dauErr;
  if (sessionErr) throw sessionErr;
  if (featureDailyErr) throw featureDailyErr;

  const dauRow = dauData as {
    dau_by_day?: unknown;
    dau?: unknown;
    wau?: unknown;
    mau?: unknown;
    stickiness?: unknown;
  } | null;

  if (!dauRow || typeof dauRow !== 'object') {
    throw new Error('get_engagement_dau_series: invalid response');
  }

  const rawDauByDay = Array.isArray(dauRow.dau_by_day) ? dauRow.dau_by_day : [];
  const dauByDay = rawDauByDay
    .map((r: unknown) => {
      const row = r as { date?: string; count?: unknown };
      return {
        date: typeof row.date === 'string' ? row.date : String(row.date ?? ''),
        count: Number(row.count ?? 0),
      };
    })
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const dau = Number(dauRow.dau ?? 0);
  const wau = Number(dauRow.wau ?? 0);
  const mau = Number(dauRow.mau ?? 0);
  const stickiness = Number(dauRow.stickiness ?? 0);

  const sess = sessionData as {
    session_count?: unknown;
    avg_session_duration_minutes?: unknown;
    avg_pages_per_session?: unknown;
  } | null;
  if (!sess || typeof sess !== 'object') {
    throw new Error('get_engagement_web_session_stats: invalid response');
  }
  const sessionCount = Number(sess.session_count ?? 0);
  const avgSessionDurationMinutes = Number(sess.avg_session_duration_minutes ?? 0);
  const avgPagesPerSession = Number(sess.avg_pages_per_session ?? 0);

  async function countEventsInWindow(
    eventNames: readonly string[],
    tsGte: string,
    tsLte: string,
    endExclusive = false
  ): Promise<number> {
    if (eventNames.length === 0) return 0;
    let q = supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .in('event_name', [...eventNames])
      .gte('timestamp', tsGte);
    q = endExclusive ? q.lt('timestamp', tsLte) : q.lte('timestamp', tsLte);
    const { count } = await q;
    return count ?? 0;
  }

  const featureActivity: EngagementStats['featureActivity'] = await Promise.all(
    FEATURE_ACTIVITY_CATALOG.map(async (f) => {
      const [count7d, count30d, prior7d] = await Promise.all([
        countEventsInWindow(f.eventNames, from7, toIso),
        countEventsInWindow(f.eventNames, from30, toIso),
        countEventsInWindow(f.eventNames, from14, from7, true),
      ]);
      const wowPercent = prior7d === 0 ? null : ((count7d - prior7d) / prior7d) * 100;
      return {
        featureId: f.id,
        name: f.name,
        surface: f.surface,
        count7d,
        count30d,
        wowPercent,
      };
    })
  );

  const trendDates: string[] = [];
  for (let i = trendDayCount - 1; i >= 0; i--) {
    trendDates.push(dateKey(new Date(toDate.getTime() - i * 24 * 60 * 60 * 1000)));
  }

  const eventToFeature = eventNameToFeatureId();
  const countsByFeatureDay = new Map<string, Map<string, number>>();
  for (const f of FEATURE_ACTIVITY_CATALOG) {
    countsByFeatureDay.set(f.id, new Map());
  }

  const dailyRows = Array.isArray((featureDailyData as { rows?: unknown })?.rows)
    ? ((featureDailyData as { rows: unknown[] }).rows as {
        event_name?: string;
        date?: string;
        count?: unknown;
      }[])
    : [];
  for (const row of dailyRows) {
    const en = row.event_name;
    const day = typeof row.date === 'string' ? row.date : String(row.date ?? '');
    const c = Number(row.count ?? 0);
    if (!en || !day) continue;
    const fid = eventToFeature.get(en);
    if (!fid) continue;
    const fm = countsByFeatureDay.get(fid);
    if (!fm) continue;
    fm.set(day, (fm.get(day) ?? 0) + c);
  }

  const featureActivityTrends: EngagementStats['featureActivityTrends'] =
    FEATURE_ACTIVITY_CATALOG.map((f) => {
      const fm = countsByFeatureDay.get(f.id)!;
      const points = trendDates.map((date) => ({
        date,
        count: fm.get(date) ?? 0,
      }));
      return { featureId: f.id, points };
    });

  const knownAppCounts = await Promise.all(
    KNOWN_ANALYTICS_APP_IDS.map((appId) =>
      supabase
        .from('analytics_events')
        .select('*', { count: 'exact', head: true })
        .eq('app_id', appId)
        .gte('timestamp', from7)
        .lte('timestamp', toIso)
        .then(({ count }) => ({ appId, count7d: count ?? 0 }))
    )
  );
  const { count: unsetCount } = await supabase
    .from('analytics_events')
    .select('*', { count: 'exact', head: true })
    .is('app_id', null)
    .gte('timestamp', from7)
    .lte('timestamp', toIso);
  const eventVolumeByAppId7d: EngagementStats['eventVolumeByAppId7d'] = [
    ...knownAppCounts,
    { appId: '(unset)', count7d: unsetCount ?? 0 },
  ];

  const { data: keyEventRows } = await supabase
    .from('analytics_events')
    .select('user_id')
    .in('event_name', [...POWER_USER_EVENT_NAMES])
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .not('user_id', 'is', null)
    .limit(POWER_USER_FETCH_LIMIT);

  const rows = keyEventRows ?? [];
  warnIfAdminAnalyticsRowCapHit(
    'engagement power-user events',
    rows.length,
    POWER_USER_FETCH_LIMIT
  );

  const eventsPerUser = new Map<string, number>();
  for (const row of rows) {
    const uid = (row as { user_id: string }).user_id;
    eventsPerUser.set(uid, (eventsPerUser.get(uid) ?? 0) + 1);
  }

  const buckets = [
    { label: '0', min: 0, max: 0 },
    { label: '1–2', min: 1, max: 2 },
    { label: '3–5', min: 3, max: 5 },
    { label: '6–10', min: 6, max: 10 },
    { label: '11–25', min: 11, max: 25 },
    { label: '26–50', min: 26, max: 50 },
    { label: '51+', min: 51, max: Infinity },
  ];
  const powerUserDistribution = buckets.map((b) => {
    const count = [...eventsPerUser.values()].filter((n) => n >= b.min && n <= b.max).length;
    return { bucket: b.label, count };
  });

  return {
    dauByDay,
    dau,
    wau,
    mau,
    stickiness,
    sessionCount,
    avgSessionDurationMinutes,
    avgPagesPerSession,
    featureActivity,
    featureActivityTrends,
    eventVolumeByAppId7d,
    powerUserDistribution,
  };
}
