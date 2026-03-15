/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyTrainerOrAdminRequest } from '@/lib/supabase/admin/auth';
import { getAllUsersWithAuthServer } from '@/lib/supabase/admin/statistics';

const SERVICE_ROLE_HINT =
  'Set SUPABASE_SERVICE_ROLE_KEY in Vercel (Project → Settings → Environment Variables) to the service_role secret from Supabase Dashboard → Project Settings → API (not the anon key). Redeploy after adding.';

function isSupabaseKeyOrRlsError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  return (
    lower.includes('invalid api key') ||
    lower.includes('jwt') ||
    lower.includes('row level security') ||
    lower.includes('rlspolicy') ||
    lower.includes('permission denied') ||
    lower.includes('supabase')
  );
}

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    await verifyTrainerOrAdminRequest(request, cookies);

    // Fetch all users (with Auth provider/claims merged). Requires service role to bypass RLS.
    const users = await getAllUsersWithAuthServer();

    return new Response(JSON.stringify(users), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Handle authentication/authorization errors
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const isSupabase = isSupabaseKeyOrRlsError(error);
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/users] Error fetching users:', error);
    }

    const errorMessage = isSupabase
      ? `Failed to fetch users. ${SERVICE_ROLE_HINT}`
      : 'Failed to fetch users';

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
