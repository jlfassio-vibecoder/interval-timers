import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  console.error('Missing Supabase environment variables!');
}

if (
  import.meta.env.DEV &&
  supabaseUrl?.includes('.supabase.com') &&
  !supabaseUrl?.includes('.supabase.co')
) {
  console.warn('PUBLIC_SUPABASE_URL may be wrong: use .supabase.co not .supabase.com');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
