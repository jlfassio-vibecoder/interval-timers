import type { HandoffPayload } from './types';

/**
 * Builds account redirect URL with handoff params.
 * @param intent - User action: save_session, view_stats, unlock_schedule, etc.
 * @param source - App ID: tabata, amrap, daily-warmup, landing
 * @param payload - Optional time, calories, rounds, preset
 * @param baseUrl - Account base URL; defaults to /account for same-origin
 */
export function buildAccountRedirectUrl(
  intent: string,
  source: string,
  payload?: Partial<Pick<HandoffPayload, 'time' | 'calories' | 'rounds' | 'preset'>>,
  baseUrl = '/account'
): string {
  const params = new URLSearchParams();
  params.set('intent', intent);
  params.set('source', source);
  params.set('from', source);

  if (payload?.time !== undefined) params.set('time', String(payload.time));
  if (payload?.calories !== undefined) params.set('calories', String(payload.calories));
  if (payload?.rounds !== undefined) params.set('rounds', String(payload.rounds));
  if (payload?.preset !== undefined) params.set('preset', payload.preset);

  const query = params.toString();
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}${query}`;
}
