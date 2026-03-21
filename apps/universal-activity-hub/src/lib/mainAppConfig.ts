/**
 * Main app (Training Log) origin for handoffs and API proxy base.
 * Single place for env-derived URLs (see UNIVERSAL_ACTIVITY_HUB_SWOT.md).
 * In production (same-origin at /hub), uses current origin so handoff POST/GET and
 * workout page open on the same deployed app. In dev (localhost), uses port 3006.
 */

export function getMainAppOrigin(): string {
  const env =
    import.meta.env.VITE_APP_ORIGIN || import.meta.env.VITE_MAIN_APP_ORIGIN;
  if (env) return env;
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]'
    ) {
      return 'http://localhost:3006';
    }
    return window.location.origin;
  }
  return 'http://localhost:3006';
}

/** Base for same-origin API during Vite dev proxy; empty when calling cross-origin main app. */
export function getApiBase(): string {
  return import.meta.env.VITE_APP_ORIGIN || '';
}
