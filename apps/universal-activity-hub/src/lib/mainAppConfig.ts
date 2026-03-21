/**
 * Main app (Training Log) origin for handoffs and API proxy base.
 * Single place for env-derived URLs (see UNIVERSAL_ACTIVITY_HUB_SWOT.md).
 */

export function getMainAppOrigin(): string {
  return (
    import.meta.env.VITE_APP_ORIGIN ||
    import.meta.env.VITE_MAIN_APP_ORIGIN ||
    'http://localhost:3006'
  );
}

/** Base for same-origin API during Vite dev proxy; empty when calling cross-origin main app. */
export function getApiBase(): string {
  return import.meta.env.VITE_APP_ORIGIN || '';
}
