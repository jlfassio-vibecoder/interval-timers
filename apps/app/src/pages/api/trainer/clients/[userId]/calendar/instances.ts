/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * POST create coach schedule instance for an assignment.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { createCoachScheduleInstance } from '@/lib/supabase/admin/trainer-client-calendar';

export const POST: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    const userId = params.userId;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { assignmentId?: string; scheduledAt?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : '';
    const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt.trim() : '';
    if (!assignmentId || !scheduledAt) {
      return new Response(JSON.stringify({ error: 'assignmentId and scheduledAt required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await createCoachScheduleInstance(viewerId, userId, role, assignmentId, scheduledAt);
    if (!result.ok) {
      const notFound =
        result.error === 'Client not found or not in your roster' ||
        result.error === 'Assignment not found';
      return new Response(JSON.stringify({ error: result.error }), {
        status: notFound ? 404 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Mission Control access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/clients/.../calendar/instances POST]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to create instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
