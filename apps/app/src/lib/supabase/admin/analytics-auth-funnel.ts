/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Auth and onboarding funnel: sign-ins/sign-ups by day, funnel counts, OAuth vs email, TTFKA,
 * minimal onboarding drop-off (`get_minimal_onboarding_dropoff` RPC).
 * Visit, first-action, TTFKA, and sign-in rollups use scale RPCs (Phase P6).
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

  const [{ data: visitData, error: visitErr }, { data: activationData, error: activationErr }] =
    await Promise.all([
      supabase.rpc('get_auth_funnel_visit_count', { p_days: days }),
      supabase.rpc('get_auth_funnel_activation_stats', { p_days: days }),
    ]);

  if (visitErr) throw visitErr;
  if (activationErr) throw activationErr;

  const visitRow = visitData as { visit_count?: unknown } | null;
  const funnelVisit = Number(visitRow?.visit_count ?? 0);

  const act = activationData as {
    funnel_first_action_distinct_users?: unknown;
    ttfka_distribution?: {
      sameDay?: unknown;
      oneToTwoDays?: unknown;
      threeToSevenDays?: unknown;
      sevenPlusDays?: unknown;
      never?: unknown;
    };
    sign_ins_by_day?: unknown;
    oauth_vs_email_from_events?: { oauth?: unknown; email?: unknown };
  } | null;

  if (!act || typeof act !== 'object') {
    throw new Error('get_auth_funnel_activation_stats: invalid response');
  }

  const ttf = act.ttfka_distribution ?? {};
  const ttfka = {
    sameDay: Number(ttf.sameDay ?? 0),
    oneToTwoDays: Number(ttf.oneToTwoDays ?? 0),
    threeToSevenDays: Number(ttf.threeToSevenDays ?? 0),
    sevenPlusDays: Number(ttf.sevenPlusDays ?? 0),
    never: Number(ttf.never ?? 0),
  };

  const signInsRaw = Array.isArray(act.sign_ins_by_day) ? act.sign_ins_by_day : [];
  const signInsByDay = signInsRaw
    .map((r: unknown) => {
      const row = r as { date?: string; count?: unknown };
      return {
        date: typeof row.date === 'string' ? row.date : String(row.date ?? ''),
        count: Number(row.count ?? 0),
      };
    })
    .filter((r) => r.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const oauthFromEvents = Number(act.oauth_vs_email_from_events?.oauth ?? 0);
  const emailFromEvents = Number(act.oauth_vs_email_from_events?.email ?? 0);
  if (oauthFromEvents > 0 || emailFromEvents > 0) {
    oauthCount = oauthFromEvents;
    emailCount = emailFromEvents;
  }

  const firstActionUsers = Number(act.funnel_first_action_distinct_users ?? 0);

  let onboardingDropOff: { step: string; completed: number; dropped: number }[] = [];
  try {
    const { data, error } = await supabase.rpc('get_minimal_onboarding_dropoff', {
      p_days: days,
    });
    if (error) throw error;
    if (Array.isArray(data)) {
      onboardingDropOff = data.map((row: unknown) => {
        const r = row as { step?: unknown; completed?: unknown; dropped?: unknown };
        return {
          step: typeof r.step === 'string' ? r.step : String(r.step ?? ''),
          completed: typeof r.completed === 'number' ? r.completed : Number(r.completed ?? 0),
          dropped: typeof r.dropped === 'number' ? r.dropped : Number(r.dropped ?? 0),
        };
      });
    }
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[getAuthFunnelStats] get_minimal_onboarding_dropoff:', err);
    }
  }

  return {
    signUpsByDay,
    signInsByDay,
    funnel: {
      visit: funnelVisit,
      signUp: funnelSignUp,
      emailConfirmed: funnelEmailConfirmed,
      firstAction: firstActionUsers,
    },
    oauthVsEmail: { oauth: oauthCount, email: emailCount },
    ttfkaDistribution: ttfka,
    onboardingDropOff,
  };
}
