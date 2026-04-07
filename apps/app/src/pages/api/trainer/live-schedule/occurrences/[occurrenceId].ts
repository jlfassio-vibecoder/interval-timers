/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PATCH reschedule / cancel a scheduled live occurrence (P1).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { patchLiveScheduleOccurrence } from '@/lib/supabase/admin/trainer-live-scheduled';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId } = await verifyRosterAccessRequest(request, cookies);
    const occurrenceId = params.occurrenceId?.trim();
    if (!occurrenceId) {
      return new Response(JSON.stringify({ error: 'occurrenceId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: {
      scheduledStartAt?: string;
      scheduledEndAt?: string;
      status?: 'scheduled' | 'cancelled' | 'completed';
      allowOverlap?: boolean;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await patchLiveScheduleOccurrence(viewerId, occurrenceId, {
      scheduledStartAt: body.scheduledStartAt,
      scheduledEndAt: body.scheduledEndAt,
      status: body.status,
      allowOverlap: body.allowOverlap === true,
    });

    if (!result.ok) {
      if ('conflicts' in result && Array.isArray(result.conflicts) && result.conflicts.length > 0) {
        return new Response(JSON.stringify({ error: result.error, conflicts: result.conflicts }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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
      console.error('[trainer/live-schedule/occurrences PATCH]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to update occurrence' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
