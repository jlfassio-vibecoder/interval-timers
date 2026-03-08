/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side utility for Supabase session cookie.
 * Sets sb-access-token so server-side routes (e.g. /admin) can authenticate via extractAccessToken.
 */

import type { Session } from '@supabase/supabase-js';

const COOKIE_NAME = 'sb-access-token';

/**
 * Set Supabase access token in a cookie for server-side authentication.
 */
export function setAuthCookie(session: Session | null): void {
  if (typeof document === 'undefined') return;

  if (!session?.access_token) {
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    return;
  }

  const isSecure = window.location.protocol === 'https:';
  const maxAge = session.expires_at
    ? Math.max(0, session.expires_at - Math.floor(Date.now() / 1000))
    : 3600;
  const opts = [
    `${COOKIE_NAME}=${encodeURIComponent(session.access_token)}`,
    'path=/',
    'SameSite=Lax',
    isSecure ? 'Secure' : '',
    `max-age=${maxAge}`,
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
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}
