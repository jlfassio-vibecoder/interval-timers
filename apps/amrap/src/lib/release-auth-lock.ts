/**
 * Best-effort release of the Supabase auth navigator.locks lock after signOut.
 * Auth-js uses lock:${storageKey}; we derive storageKey from the Supabase URL
 * (same pattern as supabase-js: {projectRef}-auth-token) and steal the lock
 * so it is released in this tab. Never throws.
 */

function getAuthLockName(): string | null {
  const url =
    (typeof import.meta !== 'undefined' &&
      (import.meta.env?.VITE_SUPABASE_URL ?? import.meta.env?.SUPABASE_URL ?? '')) ||
    '';
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim().replace(/\/+$/, '');
  const match = trimmed.match(/^https?:\/\/([^.]+)\.supabase\.co/);
  const projectRef = match ? match[1] : null;
  if (!projectRef) return null;
  const storageKey = `${projectRef}-auth-token`;
  return `lock:${storageKey}`;
}

/**
 * Request the Supabase auth lock with steal: true and release it immediately.
 * Call after signOut() to clear any stuck lock in this browser tab. No-op if
 * navigator.locks is unavailable or lock name cannot be derived. Never throws.
 */
export function releaseAuthLock(): void {
  try {
    if (typeof navigator === 'undefined' || !navigator.locks) return;
    const name = getAuthLockName();
    if (!name) return;
    navigator.locks
      .request(name, { mode: 'exclusive', steal: true }, () => Promise.resolve())
      .catch(() => {
        if (import.meta.env?.DEV) {
          // Best-effort; wrong lock name or no holder is fine
        }
      });
  } catch {
    // Never throw; best-effort cleanup
  }
}
