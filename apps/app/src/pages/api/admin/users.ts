/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';
import { getAllUsersWithAuthServer } from '@/lib/supabase/admin/statistics';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    await verifyAdminRequest(request, cookies);

    // Fetch all users (with Auth provider/claims merged)
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

    // Log other errors in development or when error logging is enabled
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/users] Error fetching users:', error);
    }

    return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
