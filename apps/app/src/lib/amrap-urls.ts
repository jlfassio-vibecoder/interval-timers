/**
 * AMRAP session URLs for HUD and app links.
 * When PUBLIC_AMRAP_BASE_URL is set (e.g. custom domain amrapwithfriends.com), links point there
 * with path /with-friends/session/{id}. Otherwise same-origin /amrap/with-friends/session/{id}.
 */

const AMRAP_BASE =
  (typeof import.meta !== 'undefined' && (import.meta.env?.PUBLIC_AMRAP_BASE_URL ?? '').trim()) ||
  '';

export interface GetAmrapCreateUrlParams {
  /** Prefill date (YYYY-MM-DD) or datetime (YYYY-MM-DDTHH:mm). Default time 09:00 when date-only. */
  date?: string;
  /** When true, add schedule=1 so Create tab opens with "Schedule for later" and date picker. */
  schedule?: boolean;
  /** When true, add from=calendar for "Back to calendar" link. */
  fromCalendar?: boolean;
}

/**
 * Returns the URL to open the AMRAP With Friends create flow with optional prefill params.
 * Used when scheduling from the calendar so the user lands on Create tab with schedule mode and date set.
 */
export function getAmrapCreateUrl(params: GetAmrapCreateUrlParams = {}): string {
  const { date, schedule = false, fromCalendar = false } = params;
  const search = new URLSearchParams();
  search.set('tab', 'create');
  if (schedule) search.set('schedule', '1');
  if (date && date.trim()) {
    const dateTrimmed = date.trim();
    const hasTime = /^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}/.test(dateTrimmed);
    search.set('date', hasTime ? dateTrimmed : `${dateTrimmed}T09:00`);
  }
  if (fromCalendar) search.set('from', 'calendar');
  const query = search.toString();
  const path = `/with-friends${query ? `?${query}` : ''}`;
  if (AMRAP_BASE) {
    const base = AMRAP_BASE.replace(/\/+$/, '');
    return `${base}${path}`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/amrap${path}`;
  }
  return `/amrap${path}`;
}

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
