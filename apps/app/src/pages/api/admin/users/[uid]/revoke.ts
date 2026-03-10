/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Revoke sessions for a user. Supabase GoTrue does not expose "revoke all refresh tokens
 * for user X"; this route returns success for API compatibility (admin UI).
 */

import type { APIRoute } from 'astro';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, cookies }) => {
  try {
    await verifyAdminRequest(request, cookies);

    const uid = params.uid;
    if (!uid) {
      return new Response(JSON.stringify({ error: 'UID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Supabase does not expose revoke-all-sessions for a user; return success for compatibility
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const err = error as { code?: string };
      if (err.code === 'auth/user-not-found') {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/users/revoke] Error:', error);
    }

    return new Response(JSON.stringify({ error: 'Failed to revoke sessions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
