/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PATCH — dismiss a coach assignment (client only).
 */

import type { APIRoute } from 'astro';
import { authenticateInvitationsApiRequest } from '@/lib/supabase/admin/auth';
import { dismissCoachAssignmentForClient } from '@/lib/supabase/admin/trainer-client-assignments';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  try {
    const auth = await authenticateInvitationsApiRequest(request, cookies);
    if (!auth.ok) {
      return auth.response;
    }
    const assignmentId = params.assignmentId;
    if (!assignmentId) {
      return new Response(JSON.stringify({ error: 'Assignment ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await dismissCoachAssignmentForClient(auth.user.id, assignmentId);
    if (!result.ok) {
      const status = result.error === 'Assignment not found' ? 404 : 400;
      return new Response(JSON.stringify({ error: result.error }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[me/coach-assignments/:id] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to dismiss assignment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
