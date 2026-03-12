import { HANDOFF_STORAGE_KEY } from '@interval-timers/handoff';

/**
 * Builds the redirect URL used after successful sign-in.
 * Appends ?from=<fromAppId> and optionally &returnUrl=<encoded returnUrl>
 * to the base URL, handling existing query params (? vs &).
 */
export function buildAuthRedirectUrl(
  redirectBaseUrl: string,
  options?: { fromAppId?: string; returnUrl?: string }
): string {
  const { fromAppId, returnUrl } = options ?? {};
  if (!fromAppId && !returnUrl) {
    return redirectBaseUrl;
  }

  const params = new URLSearchParams();
  if (fromAppId) params.set('from', fromAppId);
  if (returnUrl) params.set('returnUrl', returnUrl);
  const query = params.toString();
  if (!query) return redirectBaseUrl;

  const separator = redirectBaseUrl.includes('?') ? '&' : '?';
  return `${redirectBaseUrl}${separator}${query}`;
}

/**
 * Builds the absolute redirect URL for OAuth (signInWithOAuth).
 * Merges fromAppId and handoff params from sessionStorage so handoff
 * survives the OAuth round-trip (belt-and-suspenders with sessionStorage).
 */
export function buildOAuthRedirectUrl(
  redirectBaseUrl: string,
  fromAppId?: string
): string {
  const base =
    redirectBaseUrl.startsWith('http')
      ? redirectBaseUrl
      : new URL(redirectBaseUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost').href;
  const url = new URL(base);
  const params = new URLSearchParams(url.search);
  if (fromAppId) params.set('from', fromAppId);
  try {
    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem(HANDOFF_STORAGE_KEY);
      if (raw) {
        const h = JSON.parse(raw) as Record<string, unknown>;
        if (h.intent) params.set('intent', String(h.intent));
        if (h.source) params.set('source', String(h.source));
        if (h.time != null) params.set('time', String(h.time));
        if (h.calories != null) params.set('calories', String(h.calories));
        if (h.rounds != null) params.set('rounds', String(h.rounds));
        if (h.preset) params.set('preset', String(h.preset));
        if (h.timestamp != null) params.set('timestamp', String(h.timestamp));
        if (!params.has('from') && h.source) params.set('from', String(h.source));
      }
    }
  } catch {
    // ignore parse/storage errors
  }
  url.search = params.toString();
  return url.toString();
}
