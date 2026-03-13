/**
 * Fetch scheduled AMRAP sessions via Supabase REST API.
 * Uses direct fetch instead of Supabase client to avoid a second GoTrueClient instance.
 */

export interface ScheduledSession {
  id: string;
  duration_minutes: number;
  workout_list: string[];
  scheduled_start_at: string;
}

const url =
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '';
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  '';

export async function fetchScheduledSessions(
  weekStart: Date,
  weekEnd: Date,
  signal?: AbortSignal
): Promise<{ data: ScheduledSession[]; error: string | null }> {
  const startISO = weekStart.toISOString();
  const endISO = weekEnd.toISOString();
  // PostgREST ignores duplicate params for the same column; use and=() to combine filters.
  const andFilter = `(scheduled_start_at.gte."${startISO}",scheduled_start_at.lt."${endISO}",scheduled_start_at.not.is.null)`;
  const params = new URLSearchParams();
  params.set('select', 'id,duration_minutes,workout_list,scheduled_start_at');
  params.set('and', andFilter);
  params.set('order', 'scheduled_start_at.asc');
  const restUrl = `${url}/rest/v1/amrap_sessions?${params.toString()}`;

  try {
    const res = await fetch(restUrl, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      signal,
    });

    if (!res.ok) {
      const body = await res.text();
      return { data: [], error: body || res.statusText };
    }

    const data = (await res.json()) as ScheduledSession[];
    return { data: data ?? [], error: null };
  } catch (err) {
    if (err instanceof Error) {
      const msg =
        err.name === 'AbortError'
          ? 'Request timed out. Check your connection and try again.'
          : err.message;
      return { data: [], error: msg };
    }
    return { data: [], error: 'Unknown error' };
  }
}
