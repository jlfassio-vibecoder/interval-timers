import { createClient } from '@supabase/supabase-js';

// Require env explicitly so we never silently point at the wrong project (fail fast).
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are required. Copy .env.example to .env and set them (same project as programs for shared admin).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
