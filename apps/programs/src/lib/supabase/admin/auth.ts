/**
 * Server-side Supabase auth: verify session and admin role.
 * Replaces Firebase Admin verifyAdminRequest for admin routes.
 */

import { createClient } from '@supabase/supabase-js';

// HIIT Workout Timer Supabase (same as AMRAP). Fallback to VITE_* from monorepo.
const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

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

  if (profileError || !profile || profile.role !== 'admin') {
    throw new Error('UNAUTHORIZED');
  }

  return {
    uid: user.id,
    email: user.email ?? undefined,
  };
}

/**
 * Verify request has valid Supabase session and user has trainer or admin role.
 * Returns { uid, email } or throws UNAUTHENTICATED / UNAUTHORIZED.
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
  if (profile.role !== 'trainer' && profile.role !== 'admin') {
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
