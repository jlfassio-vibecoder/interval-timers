import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Use HIIT Workout Timer Supabase (same as AMRAP). Accept all conventional names:
// SUPABASE_*, VITE_* (Vite default), PUBLIC_* (Astro). Injected via astro.config define when needed.
// Placeholder fallbacks prevent "supabaseUrl is required" hydration crash when env is missing.
const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  'https://placeholder.supabase.co';
const supabaseAnonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

if (
  import.meta.env.DEV &&
  (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey.endsWith('.placeholder'))
) {
  console.error(
    'Missing Supabase env. Set PUBLIC_SUPABASE_URL/ANON_KEY or VITE_SUPABASE_URL/ANON_KEY (HIIT project).'
  );
}

if (
  import.meta.env.DEV &&
  supabaseUrl?.includes('.supabase.com') &&
  !supabaseUrl?.includes('.supabase.co')
) {
  console.warn('PUBLIC_SUPABASE_URL may be wrong: use .supabase.co not .supabase.com');
}

// Cross-subdomain auth (Blueprint §9): when PUBLIC_AUTH_COOKIE_DOMAIN is set, use cookies
// so the session is shared across app.hiitworkouttimer.com, hiitworkouttimer.com, etc.
const cookieDomain = (
  import.meta.env.PUBLIC_AUTH_COOKIE_DOMAIN || import.meta.env.VITE_AUTH_COOKIE_DOMAIN
)?.trim();
const useCookieStorage = !!cookieDomain && typeof window !== 'undefined';

if (useCookieStorage) {
  if (import.meta.env.DEV && cookieDomain && !cookieDomain.startsWith('.')) {
    console.warn(
      'PUBLIC_AUTH_COOKIE_DOMAIN should start with "." for subdomain sharing (e.g. .hiitworkouttimer.com)'
    );
  }
}

export const supabase = useCookieStorage
  ? createBrowserClient(supabaseUrl || '', supabaseAnonKey || '', {
      cookieOptions: { domain: cookieDomain },
    })
  : createClient(supabaseUrl || '', supabaseAnonKey || '');
