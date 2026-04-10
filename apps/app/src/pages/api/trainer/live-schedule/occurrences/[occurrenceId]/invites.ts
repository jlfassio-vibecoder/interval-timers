/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * POST add roster invitees to an existing scheduled live occurrence.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { addInvitesToLiveScheduleOccurrence } from '@/lib/supabase/admin/trainer-live-scheduled';

export const POST: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    const occurrenceId = params.occurrenceId?.trim();
    if (!occurrenceId) {
      return new Response(JSON.stringify({ error: 'occurrenceId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { inviteeUserIds?: string[] } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: 'Body must be a JSON object' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const inviteeUserIds = Array.isArray(body.inviteeUserIds)
      ? body.inviteeUserIds.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      : [];

    const result = await addInvitesToLiveScheduleOccurrence(
      viewerId,
      role,
      occurrenceId,
      inviteeUserIds
    );

    if (!result.ok) {
      const nf = result.error.includes('not found');
      return new Response(JSON.stringify({ error: result.error }), {
        status: nf ? 404 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
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
      console.error('[trainer/live-schedule/occurrences/.../invites POST]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to add invites' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
