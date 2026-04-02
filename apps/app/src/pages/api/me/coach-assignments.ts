/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET — open coach assignments for HUD (authenticated user).
 */

import type { APIRoute } from 'astro';
import { authenticateInvitationsApiRequest } from '@/lib/supabase/admin/auth';
import { listOpenCoachAssignmentsForClient } from '@/lib/supabase/admin/trainer-client-assignments';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await authenticateInvitationsApiRequest(request, cookies);
    if (!auth.ok) {
      return auth.response;
    }
    const { user } = auth;
    const assignments = await listOpenCoachAssignmentsForClient(user.id);
    return new Response(JSON.stringify({ assignments }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[me/coach-assignments] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load assignments' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
