/**
 * Server-side Supabase client (optional service role for bypassing RLS).
 * Use for API routes that need to read/write without user context (e.g. warmup-config GET).
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Force-load .env.local so API routes get correct env (Vite dev can fail to pass process.env to workers).
const rootFromFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
loadEnv({ path: resolve(process.cwd(), '.env.local'), override: true });
loadEnv({ path: resolve(rootFromFile, '.env.local'), override: true });

function normalizeEnvVar(v: string | undefined): string {
  if (v == null || typeof v !== 'string') return '';
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
    return t.slice(1, -1).trim();
  return t;
}
// Prefer process.env so node --env-file=.env.local and dotenv in astro.config win over Vite's import.meta.env (which can inject a different value in dev).
const supabaseUrl =
  normalizeEnvVar(process.env.PUBLIC_SUPABASE_URL) ||
  normalizeEnvVar(import.meta.env.PUBLIC_SUPABASE_URL as string | undefined);
const serviceRoleKey =
  normalizeEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY) ||
  normalizeEnvVar(import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined);
const anonKey =
  normalizeEnvVar(process.env.PUBLIC_SUPABASE_ANON_KEY) ||
  normalizeEnvVar(import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined);

/**
 * Client with service role key when available (bypasses RLS). Otherwise anon (RLS applies).
 */
export function getSupabaseServer() {
  if (!supabaseUrl) throw new Error('PUBLIC_SUPABASE_URL is required');
  const key = serviceRoleKey || anonKey;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY or PUBLIC_SUPABASE_ANON_KEY required');
  return createClient(supabaseUrl, key);
}
