/**
 * Read AMRAP host token from sessionStorage (same key as amrap-create-session).
 * Used to show host-only actions (Reschedule, Delete) and add ?host=1 when entering session.
 */

const SESSION_STORAGE_KEY_PREFIX = 'amrap_friends_host_token';

export function getStoredHostToken(sessionId: string): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(`${SESSION_STORAGE_KEY_PREFIX}_${sessionId}`);
  } catch {
    return null;
  }
}
