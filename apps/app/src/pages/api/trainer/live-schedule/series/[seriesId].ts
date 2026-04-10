/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PATCH cancel / update series metadata (P1).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  patchLiveScheduleSeries,
  rescheduleLiveScheduleSeriesFutureFromAnchor,
} from '@/lib/supabase/admin/trainer-live-scheduled';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId } = await verifyRosterAccessRequest(request, cookies);
    const seriesId = params.seriesId?.trim();
    if (!seriesId) {
      return new Response(JSON.stringify({ error: 'seriesId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: {
      status?: 'active' | 'cancelled';
      untilAt?: string | null;
      rescheduleAnchorOccurrenceId?: string;
      scheduledStartAt?: string;
      scheduledEndAt?: string;
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

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: 'Body must be a JSON object' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const anchor =
      typeof body.rescheduleAnchorOccurrenceId === 'string'
        ? body.rescheduleAnchorOccurrenceId.trim()
        : '';
    const rs =
      typeof body.scheduledStartAt === 'string' ? body.scheduledStartAt.trim() : '';
    const re = typeof body.scheduledEndAt === 'string' ? body.scheduledEndAt.trim() : '';

    const fullReschedule = Boolean(anchor && rs && re);
    const hasSeriesMetaPatch = body.status !== undefined || body.untilAt !== undefined;
    if (fullReschedule && hasSeriesMetaPatch) {
      return new Response(
        JSON.stringify({
          error:
            'Cannot combine series reschedule (anchor + scheduledStartAt + scheduledEndAt) with status or untilAt in one request; send separate PATCH calls.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (anchor && rs && re) {
      const r = await rescheduleLiveScheduleSeriesFutureFromAnchor(
        viewerId,
        seriesId,
        anchor,
        rs,
        re,
        body.allowOverlap === true
      );
      if (!r.ok) {
        if ('conflicts' in r && Array.isArray(r.conflicts) && r.conflicts.length > 0) {
          return new Response(JSON.stringify({ error: r.error, conflicts: r.conflicts }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const nf = r.error.includes('not found');
        return new Response(JSON.stringify({ error: r.error }), {
          status: nf ? 404 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (anchor || rs || re) {
      return new Response(
        JSON.stringify({
          error:
            'reschedule requires rescheduleAnchorOccurrenceId, scheduledStartAt, and scheduledEndAt',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await patchLiveScheduleSeries(viewerId, seriesId, {
      status: body.status,
      untilAt: body.untilAt,
    });

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
      console.error('[trainer/live-schedule/series PATCH]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to update series' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
