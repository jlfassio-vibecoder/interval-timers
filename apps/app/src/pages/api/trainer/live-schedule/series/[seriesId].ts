/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PATCH cancel / update series metadata (P1).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { patchLiveScheduleSeries } from '@/lib/supabase/admin/trainer-live-scheduled';

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
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
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
