/**
 * Server-side Supabase auth: verify session and admin role.
 * Replaces Firebase Admin verifyAdminRequest for admin routes.
 */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// HIIT Workout Timer Supabase (same as AMRAP). Accept SUPABASE_*, VITE_*, PUBLIC_* (injected via astro.config).
const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_ANON_KEY;

const COOKIE_NAME = 'sb-access-token';

/**
 * Extract Supabase access token from request (cookie or Authorization header).
 */
export function extractAccessToken(
  request: Request,
  cookies?: { get: (name: string) => { value: string } | undefined }
): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice('bearer '.length).trim() || null;
  }

  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const parsed = cookieHeader.split(';').reduce(
      (acc, part) => {
        const [key, ...val] = part.trim().split('=');
        if (key && val.length) acc[key.trim()] = decodeURIComponent(val.join('=').trim());
        return acc;
      },
      {} as Record<string, string>
    );
    const token = parsed[COOKIE_NAME] || parsed['sb-access-token'] || null;
    if (token) return token;
  }

  if (cookies) {
    const c = cookies.get(COOKIE_NAME) ?? cookies.get('sb-access-token');
    if (c?.value) return c.value;
  }

  return null;
}

const json401 = () =>
  new Response(JSON.stringify({ error: 'Authentication required' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

export type InvitationsApiAuthResult =
  | { ok: true; supabase: SupabaseClient<Database>; user: User }
  | { ok: false; response: Response };

/**
 * Bearer/cookie session for roster invitation accept routes (anon client + user JWT).
 */
export async function authenticateInvitationsApiRequest(
  request: Request,
  cookies?: { get: (name: string) => { value: string } | undefined }
): Promise<InvitationsApiAuthResult> {
  const token = extractAccessToken(request, cookies);
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return { ok: false, response: json401() };
  }
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return { ok: false, response: json401() };
  }
  return { ok: true, supabase, user };
}

/**
 * Emails to match roster invitees: auth user, user_metadata.email, profiles.email.
 * Shared by accept + accept-pending APIs.
 */
export async function collectRosterInviteCandidateEmails(
  supabase: SupabaseClient<Database>,
  user: User
): Promise<string[]> {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const candidateEmails: string[] = [];
  if (user.email) candidateEmails.push(user.email);
  if (typeof meta?.email === 'string' && meta.email.trim()) {
    candidateEmails.push(meta.email);
  }
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  // Supabase-js can infer `data` as `never` for select('*') on this schema; DB has profiles.email (baseline migration).
  const prof = data as { email?: string | null } | null;
  const profileEmail = prof?.email?.trim();
  if (profileEmail) {
    candidateEmails.push(profileEmail);
  }
  return candidateEmails;
}

/**
 * Authenticated Supabase client (user JWT) for RLS-scoped updates.
 * Throws UNAUTHENTICATED if no valid session.
 */
export async function getSupabaseUserClient(
  request: Request,
  cookies?: { get: (name: string) => { value: string } | undefined }
): Promise<{ supabase: SupabaseClient<Database>; uid: string }> {
  const token = extractAccessToken(request, cookies);
  if (!token) throw new Error('UNAUTHENTICATED');
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('UNAUTHENTICATED');
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user) throw new Error('UNAUTHENTICATED');
  return { supabase, uid: user.id };
}

/**
 * Verify request has valid Supabase session and user has admin role.
 * Returns { uid, email } or throws UNAUTHENTICATED / UNAUTHORIZED.
 */
export async function verifyAdminRequest(
  request: Request,
  cookies?: { get: (name: string) => { value: string } | undefined }
): Promise<{ uid: string; email?: string }> {
  const token = extractAccessToken(request, cookies);
  if (!token) throw new Error('UNAUTHENTICATED');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('UNAUTHENTICATED');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) throw new Error('UNAUTHENTICATED');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role;
  if (profileError || !profile || (role !== 'admin' && role !== 'super_admin')) {
    throw new Error('UNAUTHORIZED');
  }

  return {
    uid: user.id,
    email: user.email ?? undefined,
  };
}

/**
 * Verify request has valid Supabase session and user has Mission Control access
 * (host; admin/super_admin; or coach row in public.trainers).
 * Returns { uid, email, role } with role `'trainer'` when the profile is `client` but a coach row exists
 * (compat for roster invite APIs).
 */
export async function verifyMissionControlRequest(
  request: Request,
  cookies?: { get: (name: string) => { value: string } | undefined }
): Promise<{ uid: string; email?: string; role: string }> {
  const token = extractAccessToken(request, cookies);
  if (!token) throw new Error('UNAUTHENTICATED');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('UNAUTHENTICATED');
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) throw new Error('UNAUTHENTICATED');

  // Deploy DB migrations before app: is_mission_control_staff() must exist. No "missing RPC" fallback—
  // parsing provider error strings is brittle and would hide misconfigured databases.
  const { data: mcOk, error: mcErr } = await supabase.rpc('is_mission_control_staff');
  if (mcErr || mcOk !== true) throw new Error('UNAUTHORIZED');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) throw new Error('UNAUTHORIZED');

  const r = (profile as { role: string }).role;
  let effectiveRole = r;
  if (r === 'client') {
    const { data: tr } = await supabase
      .from('trainers')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (tr) effectiveRole = 'trainer';
  }

  if (
    effectiveRole !== 'host' &&
    effectiveRole !== 'trainer' &&
    effectiveRole !== 'admin' &&
    effectiveRole !== 'super_admin'
  ) {
    throw new Error('UNAUTHORIZED');
  }

  return {
    uid: user.id,
    email: user.email ?? undefined,
    role: effectiveRole,
  };
}

/**
 * Roster + roster invite APIs: same roles as Mission Control (host, trainer, admin, super_admin).
 * Alias of {@link verifyMissionControlRequest} for readable call sites.
 */
export async function verifyRosterAccessRequest(
  request: Request,
  cookies?: { get: (name: string) => { value: string } | undefined }
): Promise<{ uid: string; email?: string; role: string }> {
  return verifyMissionControlRequest(request, cookies);
}

/**
 * Verify request has valid Supabase session and user has trainer or admin role.
 * Returns { uid, email } or throws UNAUTHENTICATED / UNAUTHORIZED.
 * Use verifyMissionControlRequest for host-inclusive checks.
 */
export async function verifyTrainerOrAdminRequest(
  request: Request,
  cookies?: { get: (name: string) => { value: string } | undefined }
): Promise<{ uid: string; email?: string }> {
  const token = extractAccessToken(request, cookies);
  if (!token) throw new Error('UNAUTHENTICATED');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('UNAUTHENTICATED');
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) throw new Error('UNAUTHENTICATED');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) throw new Error('UNAUTHORIZED');
  const role = (profile as { role: string }).role;
  if (role === 'admin' || role === 'super_admin') {
    return {
      uid: user.id,
      email: user.email ?? undefined,
    };
  }
  const { data: tr } = await supabase
    .from('trainers')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (tr) {
    return {
      uid: user.id,
      email: user.email ?? undefined,
    };
  }
  throw new Error('UNAUTHORIZED');
}

/**
 * Get current user from request (no admin check).
 * Returns { uid, email } if authenticated, null otherwise.
 */
export async function getCurrentUserFromRequest(
  request: Request,
  cookies?: { get: (name: string) => { value: string } | undefined }
): Promise<{ uid: string; email?: string } | null> {
  try {
    const token = extractAccessToken(request, cookies);
    if (!token || !supabaseUrl || !supabaseAnonKey) return null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) return null;
    return { uid: user.id, email: user.email ?? undefined };
  } catch {
    return null;
  }
}
