import { createClient } from '@supabase/supabase-js';

// Use HIIT Workout Timer Supabase (same as AMRAP). Prefer PUBLIC_*, fallback to VITE_* from monorepo.
const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
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

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
