/**
 * Server-side Supabase client (optional service role for bypassing RLS).
 * Use for API routes that need to read/write without user context (e.g. warmup-config GET).
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Force-load .env so API routes get HIIT Supabase. Load monorepo root first, then app-level.
const rootFromFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const monorepoRoot = resolve(rootFromFile, '../..');
loadEnv({ path: resolve(monorepoRoot, '.env') });
loadEnv({ path: resolve(monorepoRoot, '.env.local') });
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: resolve(rootFromFile, '.env.local'), override: true });

function normalizeEnvVar(v: string | undefined): string {
  if (v == null || typeof v !== 'string') return '';
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
    return t.slice(1, -1).trim();
  return t;
}
// Prefer process.env. Accept SUPABASE_*, PUBLIC_*, VITE_* (Vercel often uses SUPABASE_URL).
const supabaseUrl =
  normalizeEnvVar(process.env.SUPABASE_URL) ||
  normalizeEnvVar(process.env.PUBLIC_SUPABASE_URL) ||
  normalizeEnvVar(process.env.VITE_SUPABASE_URL) ||
  normalizeEnvVar(import.meta.env.PUBLIC_SUPABASE_URL as string | undefined) ||
  normalizeEnvVar(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const serviceRoleKey =
  normalizeEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
  normalizeEnvVar(import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined);
const anonKey =
  normalizeEnvVar(process.env.SUPABASE_ANON_KEY) ||
  normalizeEnvVar(process.env.PUBLIC_SUPABASE_ANON_KEY) ||
  normalizeEnvVar(process.env.VITE_SUPABASE_ANON_KEY) ||
  normalizeEnvVar(import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
  normalizeEnvVar(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

/**
 * Client with service role key when available (bypasses RLS). Otherwise anon (RLS applies).
 */
export function getSupabaseServer() {
  if (!supabaseUrl) throw new Error('SUPABASE_URL or PUBLIC_SUPABASE_URL or VITE_SUPABASE_URL required');
  const key = serviceRoleKey || anonKey;
  if (!key)
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or PUBLIC_SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY required'
    );
  return createClient(supabaseUrl, key);
}
