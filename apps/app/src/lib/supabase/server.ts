/**
 * Server-side Supabase client (optional service role for bypassing RLS).
 * Use for API routes that need to read/write without user context (e.g. warmup-config GET).
 *
 * Mission Control (`/api/trainer/*`, roster, programs): use {@link getSupabaseMissionControl} so
 * production fails fast when `SUPABASE_SERVICE_ROLE_KEY` is missing (anon-only clients get RLS 401/empty).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

const isProdLike =
  process.env.NODE_ENV === 'production' || process.env.CI === 'true' || process.env.VERCEL === '1';

/** One line per server isolate (Vercel function cold start) when logging is enabled. */
let loggedSupabaseClientMode = false;

function supabaseUrlHost(): string {
  try {
    return new URL(supabaseUrl).host;
  } catch {
    return 'invalid_url';
  }
}

function maybeLogSupabaseClientMode(usingServiceRole: boolean): void {
  const explicit = process.env.LOG_SUPABASE_CLIENT_MODE === '1';
  if (!explicit && !isProdLike) return;
  if (!explicit && import.meta.env.DEV) return;
  if (loggedSupabaseClientMode) return;
  loggedSupabaseClientMode = true;
  console.warn('[supabase/server] client_mode', {
    using_service_role: usingServiceRole,
    supabase_host: supabaseUrlHost(),
    key_kind: serviceRoleKey ? 'service_role' : anonKey ? 'anon' : 'none',
  });
}

export type GetSupabaseServerOptions = {
  /**
   * When true, production refuses anon fallback — required for Mission Control DB paths that
   * expect RLS-bypassing reads (programs, roster, invitations, trainer assignments).
   */
  requireServiceRole?: boolean;
};

/**
 * Whether the server has the Supabase service role key (bypasses RLS). Used to hint when admin list is empty.
 */
export function hasServiceRoleKey(): boolean {
  return !!serviceRoleKey;
}

/**
 * Anon-key client without persisted session. Use for server-triggered Auth email sends
 * (e.g. `signInWithOtp`) where the service-role client is not appropriate.
 */
export function getSupabaseAnonClient(): SupabaseClient | null {
  if (!supabaseUrl || !anonKey) return null;
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Client with service role key when available (bypasses RLS). Otherwise anon (RLS applies).
 * Admin APIs (e.g. users list) need service role to read all profiles; with anon key RLS often returns empty.
 *
 * Set `LOG_SUPABASE_CLIENT_MODE=1` (Vercel env) to log once per cold start: `using_service_role`, host, `key_kind`.
 */
export function getSupabaseServer(options?: GetSupabaseServerOptions): SupabaseClient {
  if (!supabaseUrl)
    throw new Error('SUPABASE_URL or PUBLIC_SUPABASE_URL or VITE_SUPABASE_URL required');

  if (options?.requireServiceRole && !serviceRoleKey) {
    if (isProdLike) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is required for Mission Control API routes in production. Set it in the Vercel project for this app (same Supabase project as your data). Redeploy after saving.'
      );
    }
    console.warn(
      '[supabase/server] requireServiceRole: no service role in development — using anon; Mission Control queries may be empty or fail under RLS.'
    );
  }

  const key = serviceRoleKey || anonKey;
  if (!key)
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or PUBLIC_SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY required'
    );

  const usingServiceRole = !!serviceRoleKey && key === serviceRoleKey;
  maybeLogSupabaseClientMode(usingServiceRole);

  if (!serviceRoleKey && isProdLike && !options?.requireServiceRole) {
    console.warn(
      '[supabase/server] SUPABASE_SERVICE_ROLE_KEY is not set. Admin routes that rely on anon may see RLS empty results or 401. Set the service_role secret from Supabase Dashboard → API in Vercel env.'
    );
  }
  return createClient(supabaseUrl, key);
}

/**
 * Supabase client for Mission Control trainer APIs (roster, programs, invitations, assignments).
 * In production, throws if `SUPABASE_SERVICE_ROLE_KEY` is missing (no silent anon fallback).
 */
export function getSupabaseMissionControl(): SupabaseClient {
  return getSupabaseServer({ requireServiceRole: true });
}
