import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    'AMRAP With Friends: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env'
  );
}

// Cross-subdomain auth (Blueprint §9): when VITE_AUTH_COOKIE_DOMAIN is set, use cookies
// so the session is shared across amrap.hiitworkouttimer.com, app.hiitworkouttimer.com, etc.
const cookieDomain = (
  import.meta.env.VITE_AUTH_COOKIE_DOMAIN ||
  import.meta.env.PUBLIC_AUTH_COOKIE_DOMAIN
)?.trim();
const useCookieStorage = !!cookieDomain && typeof window !== 'undefined';

if (useCookieStorage) {
  if (import.meta.env.DEV && cookieDomain && !cookieDomain.startsWith('.')) {
    console.warn(
      'VITE_AUTH_COOKIE_DOMAIN should start with "." for subdomain sharing (e.g. .hiitworkouttimer.com)'
    );
  }
}

export const supabase = useCookieStorage
  ? createBrowserClient(url ?? '', anonKey ?? '', {
      cookieOptions: { domain: cookieDomain },
    })
  : createClient(url ?? '', anonKey ?? '');

export type AmrapSessionRow = {
  id: string;
  host_token: string;
  duration_minutes: number;
  workout_list: string[];
  state: 'waiting' | 'setup' | 'work' | 'finished';
  time_left_sec: number;
  is_paused: boolean;
  started_at: string | null;
  created_at: string;
  scheduled_start_at: string | null;
};

/** Session fields safe to expose to all clients; exclude host_token to prevent takeover. */
export type AmrapSessionPublic = Omit<AmrapSessionRow, 'host_token'>;

export type AmrapParticipantRow = {
  id: string;
  session_id: string;
  nickname: string;
  role: 'host' | 'joiner';
  joined_at: string;
};

export type AmrapRoundRow = {
  id: string;
  session_id: string;
  participant_id: string;
  round_index: number;
  elapsed_sec_at_round: number;
};

export type AmrapSessionMessageRow = {
  id: string;
  session_id: string;
  participant_id: string;
  body: string;
  created_at: string;
};
