/**
 * AMRAP session URLs for HUD and app links.
 * When PUBLIC_AMRAP_BASE_URL is set (e.g. custom domain amrapwithfriends.com), links point there
 * with path /with-friends/session/{id}. Otherwise same-origin /amrap/with-friends/session/{id}.
 */

const AMRAP_BASE =
  (typeof import.meta !== 'undefined' && (import.meta.env?.PUBLIC_AMRAP_BASE_URL ?? '').trim()) ||
  '';

/**
 * Returns the URL to open an AMRAP With Friends session.
 * Use for href, window.location.href, or copy-to-clipboard.
 */
export function getAmrapSessionUrl(sessionId: string): string {
  if (AMRAP_BASE) {
    const base = AMRAP_BASE.replace(/\/+$/, '');
    return `${base}/with-friends/session/${sessionId}`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/amrap/with-friends/session/${sessionId}`;
  }
  return `/amrap/with-friends/session/${sessionId}`;
}
