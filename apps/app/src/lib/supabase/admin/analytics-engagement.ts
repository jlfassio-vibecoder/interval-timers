/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Engagement: DAU/WAU/MAU, stickiness, sessions, feature adoption, power-user distribution.
 */

import { getSupabaseServer } from '../server';

const KEY_EVENTS = [
  'timer_session_complete',
  'hub_timer_launch_1',
  'hub_timer_launch_2',
  'timer_save_click',
  'account_land_handoff',
  'account_session_prefill_success',
] as const;

export interface EngagementStats {
  dauByDay: { date: string; count: number }[];
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  sessionCount: number;
  avgSessionDurationMinutes: number;
  avgPagesPerSession: number;
  featureAdoption: { eventName: string; count7d: number; count30d: number }[];
  powerUserDistribution: { bucket: string; count: number }[];
}

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
  const thirtyDaysAgo = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from7 = sevenDaysAgo.toISOString();
  const from30 = thirtyDaysAgo.toISOString();

  // Distinct user_id per day from analytics_events and web_events (union per date)
  const dauByDayMap = new Map<string, Set<string>>();

  const addUserToDay = (dateStr: string, userId: string) => {
    if (!dateStr || !userId) return;
    let set = dauByDayMap.get(dateStr);
    if (!set) {
      set = new Set();
      dauByDayMap.set(dateStr, set);
    }
    set.add(userId);
  };

  const { data: aeRows } = await supabase
    .from('analytics_events')
    .select('user_id, timestamp')
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .not('user_id', 'is', null)
    .limit(10000);

  for (const row of aeRows ?? []) {
    const uid = (row as { user_id: string }).user_id;
    const ts = (row as { timestamp: string }).timestamp;
    addUserToDay(ts.slice(0, 10), uid);
  }

  const { data: weRows } = await supabase
    .from('web_events')
    .select('user_id, occurred_at')
    .gte('occurred_at', fromIso)
    .lte('occurred_at', toIso)
    .not('user_id', 'is', null)
    .limit(10000);

  for (const row of weRows ?? []) {
    const uid = (row as { user_id: string }).user_id;
    const ts = (row as { occurred_at: string }).occurred_at;
    addUserToDay(ts.slice(0, 10), uid);
  }

  const dauByDay = Array.from(dauByDayMap.entries())
    .map(([date, set]) => ({ date, count: set.size }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const lastDayInRange = dauByDay.length ? dauByDay[dauByDay.length - 1].date : dateKey(toDate);
  const dau = dauByDayMap.get(lastDayInRange)?.size ?? 0;

  let wauSet = new Set<string>();
  let mauSet = new Set<string>();
  for (const [date, set] of dauByDayMap) {
    if (date >= from7) set.forEach((u) => wauSet.add(u));
    if (date >= from30) set.forEach((u) => mauSet.add(u));
  }
  const wau = wauSet.size;
  const mau = mauSet.size;
  const stickiness = mau > 0 ? wau / mau : 0;

  // Sessions from web_events (page_view): group by session_id
  const { data: sessionRows } = await supabase
    .from('web_events')
    .select('session_id, user_id, occurred_at')
    .eq('event_name', 'page_view')
    .gte('occurred_at', fromIso)
    .lte('occurred_at', toIso)
    .limit(15000);

  const sessionMap = new Map<string, { start: number; end: number; pages: number }>();
  for (const row of sessionRows ?? []) {
    const sid =
      (row as { session_id?: string | null }).session_id ?? (row as { user_id?: string }).user_id;
    if (!sid) continue;
    const ts = new Date((row as { occurred_at: string }).occurred_at).getTime();
    let s = sessionMap.get(sid);
    if (!s) {
      s = { start: ts, end: ts, pages: 0 };
      sessionMap.set(sid, s);
    }
    s.start = Math.min(s.start, ts);
    s.end = Math.max(s.end, ts);
    s.pages += 1;
  }

  const sessionCount = sessionMap.size;
  let totalDurationMs = 0;
  let totalPages = 0;
  for (const s of sessionMap.values()) {
    totalDurationMs += s.end - s.start;
    totalPages += s.pages;
  }
  const avgSessionDurationMinutes = sessionCount > 0 ? totalDurationMs / 60000 / sessionCount : 0;
  const avgPagesPerSession = sessionCount > 0 ? totalPages / sessionCount : 0;

  // Feature adoption: key events count in last 7d and last 30d
  const featureAdoption: EngagementStats['featureAdoption'] = [];
  for (const eventName of KEY_EVENTS) {
    const { count: count7 } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', eventName)
      .gte('timestamp', from7)
      .lte('timestamp', toIso);
    const { count: count30 } = await supabase
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', eventName)
      .gte('timestamp', from30)
      .lte('timestamp', toIso);
    featureAdoption.push({
      eventName,
      count7d: count7 ?? 0,
      count30d: count30 ?? 0,
    });
  }

  // Power-user: count key events per user in range, then bucket
  const { data: keyEventRows } = await supabase
    .from('analytics_events')
    .select('user_id')
    .in('event_name', [...KEY_EVENTS])
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .not('user_id', 'is', null)
    .limit(10000);

  const eventsPerUser = new Map<string, number>();
  for (const row of keyEventRows ?? []) {
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
    featureAdoption,
    powerUserDistribution,
  };
}
