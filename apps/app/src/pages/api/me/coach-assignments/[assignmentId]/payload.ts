/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET — workout/WOD Artist JSON or program pointer for an assignment the user owns.
 */

import type { APIRoute } from 'astro';
import { authenticateInvitationsApiRequest } from '@/lib/supabase/admin/auth';
import { getCoachAssignmentPayloadForClient } from '@/lib/supabase/admin/trainer-client-assignments';

export const GET: APIRoute = async ({ request, cookies, params }) => {
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

    const payload = await getCoachAssignmentPayloadForClient(auth.user.id, assignmentId);
    if (!payload.ok) {
      const status = payload.error === 'Assignment not found' ? 404 : 400;
      return new Response(JSON.stringify({ error: payload.error }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (payload.assignmentType === 'program') {
      return new Response(
        JSON.stringify({
          assignmentType: 'program',
          programId: payload.programId,
          title: payload.title,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (payload.assignmentType === 'exercise') {
      return new Response(
        JSON.stringify({
          assignmentType: 'exercise',
          slug: payload.slug,
          title: payload.title,
          href: payload.href,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (payload.assignmentType === 'challenge') {
      return new Response(
        JSON.stringify({
          assignmentType: 'challenge',
          challengeId: payload.challengeId,
          title: payload.title,
          href: payload.href,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        assignmentType: payload.assignmentType,
        artist: payload.artist,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[me/coach-assignments/:id/payload] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load assignment' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
