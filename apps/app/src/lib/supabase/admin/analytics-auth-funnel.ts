/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Auth and onboarding funnel: sign-ins/sign-ups by day, funnel counts, OAuth vs email, TTFKA.
 */

import { getSupabaseServer } from '../server';

export interface AuthFunnelStats {
  signUpsByDay: { date: string; count: number }[];
  signInsByDay: { date: string; count: number }[];
  funnel: {
    visit: number;
    signUp: number;
    emailConfirmed: number;
    firstAction: number;
  };
  oauthVsEmail: { oauth: number; email: number };
  ttfkaDistribution: {
    sameDay: number;
    oneToTwoDays: number;
    threeToSevenDays: number;
    sevenPlusDays: number;
    never: number;
  };
  onboardingDropOff?: { step: string; completed: number; dropped: number }[];
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getAuthFunnelStats(days: number): Promise<AuthFunnelStats> {
  const supabase = getSupabaseServer();
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);
  const fromIso = fromDate.toISOString();
  const toIso = toDate.toISOString();

  const signUpsByDayMap = new Map<string, number>();
  let funnelSignUp = 0;
  let funnelEmailConfirmed = 0;
  let oauthCount = 0;
  let emailCount = 0;

  // Auth: listUsers for sign-ups by day, funnel.signUp, funnel.emailConfirmed, and provider mix
  const perPage = 1000;
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[getAuthFunnelStats] listUsers error:', error);
      }
      break;
    }
    const users = data?.users ?? [];
    for (const u of users) {
      const createdAt = (u as { created_at?: string }).created_at;
      if (!createdAt) continue;
      const created = new Date(createdAt);
      if (created < fromDate || created > toDate) continue;
      funnelSignUp += 1;
      const key = dateKey(created);
      signUpsByDayMap.set(key, (signUpsByDayMap.get(key) ?? 0) + 1);
      const emailConfirmed = !!(u as { email_confirmed_at?: string | null }).email_confirmed_at;
      if (emailConfirmed) funnelEmailConfirmed += 1;
      const identities = (u as { identities?: Array<{ provider?: string }> }).identities ?? [];
      const isOAuth = identities.some(
        (i) => i?.provider && i.provider !== 'email' && i.provider !== 'password'
      );
      if (isOAuth) oauthCount += 1;
      else emailCount += 1;
    }
    hasMore = users.length === perPage;
    page += 1;
  }

  const signUpsByDay = Array.from(signUpsByDayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Sign-ins by day: analytics_events account_login_complete
  const { data: loginRows } = await supabase
    .from('analytics_events')
    .select('timestamp')
    .eq('event_name', 'account_login_complete')
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .limit(5000);

  const signInsByDayMap = new Map<string, number>();
  for (const row of loginRows ?? []) {
    const ts = (row as { timestamp: string }).timestamp;
    const key = ts.slice(0, 10);
    signInsByDayMap.set(key, (signInsByDayMap.get(key) ?? 0) + 1);
  }
  const signInsByDay = Array.from(signInsByDayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // OAuth vs email from events (override or supplement auth): account_signup_complete / account_login_complete properties
  const { data: methodRows } = await supabase
    .from('analytics_events')
    .select('properties')
    .in('event_name', ['account_signup_complete', 'account_login_complete'])
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .limit(5000);

  let oauthFromEvents = 0;
  let emailFromEvents = 0;
  for (const row of methodRows ?? []) {
    const method = (row.properties as { method?: string })?.method ?? '';
    if (method === 'oauth') oauthFromEvents += 1;
    else if (method === 'email') emailFromEvents += 1;
  }
  if (oauthFromEvents > 0 || emailFromEvents > 0) {
    oauthCount = oauthFromEvents;
    emailCount = emailFromEvents;
  }

  // Funnel visit: distinct visitors from web_events in range
  const { data: visitRows } = await supabase
    .from('web_events')
    .select('session_id, user_id')
    .gte('occurred_at', fromIso)
    .lte('occurred_at', toIso)
    .limit(10000);

  const visitSet = new Set<string>();
  for (const row of visitRows ?? []) {
    const v =
      (row as { user_id?: string | null; session_id?: string | null }).user_id ??
      (row as { session_id?: string | null }).session_id;
    if (v) visitSet.add(String(v));
  }
  const funnelVisit = visitSet.size;

  // Funnel firstAction: distinct user_id with timer_session_complete or hub_timer_launch_1
  const { data: keyEventRows } = await supabase
    .from('analytics_events')
    .select('user_id')
    .in('event_name', ['timer_session_complete', 'hub_timer_launch_1'])
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .not('user_id', 'is', null);

  const firstActionUsers = new Set(
    (keyEventRows ?? []).map((r) => (r as { user_id: string }).user_id).filter(Boolean)
  );

  // TTFKA: users with account_signup_complete in range -> first key event timestamp
  const { data: signupEvents } = await supabase
    .from('analytics_events')
    .select('user_id, timestamp')
    .eq('event_name', 'account_signup_complete')
    .gte('timestamp', fromIso)
    .lte('timestamp', toIso)
    .not('user_id', 'is', null);

  const signupByUser = new Map<string, number>();
  for (const row of signupEvents ?? []) {
    const uid = (row as { user_id: string }).user_id;
    const ts = new Date((row as { timestamp: string }).timestamp).getTime();
    if (!signupByUser.has(uid) || ts < signupByUser.get(uid)!) {
      signupByUser.set(uid, ts);
    }
  }

  // First key event per user for TTFKA; limit 10k may undercount if key events exceed that globally.
  const { data: firstKeyEvents } = await supabase
    .from('analytics_events')
    .select('user_id, timestamp')
    .in('event_name', ['timer_session_complete', 'hub_timer_launch_1'])
    .not('user_id', 'is', null)
    .order('timestamp', { ascending: true })
    .limit(10000);

  const firstKeyByUser = new Map<string, number>();
  for (const row of firstKeyEvents ?? []) {
    const uid = (row as { user_id: string }).user_id;
    const ts = new Date((row as { timestamp: string }).timestamp).getTime();
    if (!firstKeyByUser.has(uid) || ts < firstKeyByUser.get(uid)!) {
      firstKeyByUser.set(uid, ts);
    }
  }

  const ttfka = {
    sameDay: 0,
    oneToTwoDays: 0,
    threeToSevenDays: 0,
    sevenPlusDays: 0,
    never: 0,
  };
  const dayMs = 24 * 60 * 60 * 1000;
  for (const [uid, signupTs] of signupByUser) {
    const firstTs = firstKeyByUser.get(uid);
    if (firstTs == null) {
      ttfka.never += 1;
      continue;
    }
    const deltaDays = (firstTs - signupTs) / dayMs;
    if (deltaDays < 1) ttfka.sameDay += 1;
    else if (deltaDays <= 2) ttfka.oneToTwoDays += 1;
    else if (deltaDays <= 7) ttfka.threeToSevenDays += 1;
    else ttfka.sevenPlusDays += 1;
  }

  return {
    signUpsByDay,
    signInsByDay,
    funnel: {
      visit: funnelVisit,
      signUp: funnelSignUp,
      emailConfirmed: funnelEmailConfirmed,
      firstAction: firstActionUsers.size,
    },
    oauthVsEmail: { oauth: oauthCount, email: emailCount },
    ttfkaDistribution: ttfka,
  };
}
