/**
 * Hub funnel analytics. POSTs to main app /api/analytics/hub-funnel (no Supabase in hub).
 */

const STORAGE_KEY = 'it_analytics_session_id';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return '';
  }
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

const API_BASE = import.meta.env.VITE_APP_ORIGIN || '';

/**
 * Fire-and-forget funnel event. POSTs to hub-funnel API.
 * Dev-only console.warn on failure.
 */
export function trackHubFunnelEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;

  const url = API_BASE ? `${API_BASE}/api/analytics/hub-funnel` : '/api/analytics/hub-funnel';
  const body = {
    event_name: eventName,
    session_id: getOrCreateSessionId() || undefined,
    properties: properties ?? {},
    app_id: 'universal_activity_hub',
  };

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
  }).catch((err) => {
    if (import.meta.env?.DEV) {
      console.warn('[hubAnalytics] trackHubFunnelEvent failed:', err);
    }
  });
}
