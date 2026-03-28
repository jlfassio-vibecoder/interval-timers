/**
 * Server-side Supabase auth: verify session and admin role.
 * Replaces Firebase Admin verifyAdminRequest for admin routes.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

/** Roles that can access Mission Control (host, trainer, admin, super_admin). */
const MISSION_CONTROL_ROLES = ['host', 'trainer', 'admin', 'super_admin'] as const;

/**
 * Verify request has valid Supabase session and user has Mission Control access
 * (host, trainer, admin, or super_admin).
 * Returns { uid, email, role } or throws UNAUTHENTICATED / UNAUTHORIZED.
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

  if (profileError || !profile) throw new Error('UNAUTHORIZED');
  if (!MISSION_CONTROL_ROLES.includes(profile.role as (typeof MISSION_CONTROL_ROLES)[number])) {
    throw new Error('UNAUTHORIZED');
  }

  return {
    uid: user.id,
    email: user.email ?? undefined,
    role: profile.role,
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

  if (profileError || !profile) throw new Error('UNAUTHORIZED');
  const role = profile.role;
  if (role !== 'trainer' && role !== 'admin' && role !== 'super_admin') {
    throw new Error('UNAUTHORIZED');
  }

  return {
    uid: user.id,
    email: user.email ?? undefined,
  };
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
