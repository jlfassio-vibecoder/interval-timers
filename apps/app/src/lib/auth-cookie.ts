/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side utility for Supabase session cookie.
 * Sets sb-access-token so server-side routes (e.g. /admin) can authenticate via extractAccessToken.
 *
 * For cross-subdomain auth (Blueprint §9): set PUBLIC_AUTH_COOKIE_DOMAIN=.yourdomain.com
 * so the cookie is readable by app.yourdomain.com, yourdomain.com, etc.
 */

import type { Session } from '@supabase/supabase-js';

const COOKIE_NAME = 'sb-access-token';

function getCookieDomain(): string | null {
  if (typeof import.meta === 'undefined') return null;
  const domain =
    import.meta.env.PUBLIC_AUTH_COOKIE_DOMAIN || import.meta.env.VITE_AUTH_COOKIE_DOMAIN;
  if (!domain || typeof domain !== 'string') return null;
  const trimmed = domain.trim();
  if (!trimmed) return null;
  if (import.meta.env.DEV && !trimmed.startsWith('.')) {
    console.warn(
      'PUBLIC_AUTH_COOKIE_DOMAIN should start with "." for subdomain sharing (e.g. .hiitworkouttimer.com)'
    );
  }
  return trimmed;
}

function buildCookieOptions(extra: string[] = []): string[] {
  const domain = getCookieDomain();
  const opts = ['path=/', 'SameSite=Lax', ...extra];
  if (domain) opts.push(`domain=${domain}`);
  return opts;
}

/**
 * Set Supabase access token in a cookie for server-side authentication.
 * When PUBLIC_AUTH_COOKIE_DOMAIN is set (e.g. .hiitworkouttimer.com), the cookie
 * is shared across subdomains for cross-origin auth (Blueprint §9).
 */
export function setAuthCookie(session: Session | null): void {
  if (typeof document === 'undefined') return;

  const clearOpts = ['expires=Thu, 01 Jan 1970 00:00:00 GMT', ...buildCookieOptions()];

  if (!session?.access_token) {
    document.cookie = `${COOKIE_NAME}=; ${clearOpts.join('; ')}`;
    return;
  }

  const isSecure = window.location.protocol === 'https:';
  const maxAge = session.expires_at
    ? Math.max(0, session.expires_at - Math.floor(Date.now() / 1000))
    : 3600;
  const opts = [
    `${COOKIE_NAME}=${encodeURIComponent(session.access_token)}`,
    ...buildCookieOptions([isSecure ? 'Secure' : '', `max-age=${maxAge}`].filter(Boolean)),
  ]
    .filter(Boolean)
    .join('; ');
  document.cookie = opts;
}

/**
 * Clear the auth cookie.
 */
export function clearAuthCookie(): void {
  if (typeof document === 'undefined') return;
  const opts = ['expires=Thu, 01 Jan 1970 00:00:00 GMT', ...buildCookieOptions()];
  document.cookie = `${COOKIE_NAME}=; ${opts.join('; ')}`;
}
