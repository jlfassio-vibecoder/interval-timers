import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Use HIIT Workout Timer Supabase (same as AMRAP). Accept all conventional names:
// SUPABASE_*, VITE_* (Vite default), PUBLIC_* (Astro). Injected via astro.config define when needed.
const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  '';
const supabaseAnonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY ||
  '';

const isPlaceholder = !supabaseUrl || !supabaseAnonKey;
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

// Production: fail fast to avoid sending auth to wrong project
if (!import.meta.env.DEV && isPlaceholder) {
  throw new Error(
    'Missing Supabase env in production. Set SUPABASE_URL/ANON_KEY, VITE_SUPABASE_* or PUBLIC_SUPABASE_*. See docs/SUPABASE_ENV.md'
  );
}

// Dev: use placeholders to prevent hydration crash; warn
const url = isPlaceholder ? PLACEHOLDER_URL : supabaseUrl;
const anonKey = isPlaceholder ? PLACEHOLDER_KEY : supabaseAnonKey;
if (import.meta.env.DEV && isPlaceholder) {
  console.error(
    'Missing Supabase env. Set SUPABASE_URL/ANON_KEY, VITE_SUPABASE_*, or PUBLIC_SUPABASE_* (HIIT project). See docs/SUPABASE_ENV.md'
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
  ? createBrowserClient(url, anonKey, {
      cookieOptions: { domain: cookieDomain },
    })
  : createClient(url, anonKey);
