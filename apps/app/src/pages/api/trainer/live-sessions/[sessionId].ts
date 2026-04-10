/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PATCH trainer-owned live session (end session, shell) from Mission Control.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { patchTrainerLiveSessionForOwner } from '@/lib/supabase/admin/trainer-live-session-admin';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId } = await verifyRosterAccessRequest(request, cookies);
    const sessionId = params.sessionId?.trim();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'sessionId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: {
      endSession?: boolean;
      endedAt?: string | null;
      shell?: 'video_only' | 'countdown_timer';
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

    if (body.endSession === true && body.shell !== undefined) {
      return new Response(
        JSON.stringify({ error: 'Send endSession or shell in separate requests' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await patchTrainerLiveSessionForOwner(viewerId, sessionId, {
      endSession: body.endSession === true,
      endedAt: body.endedAt,
      shell: body.shell,
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
      console.error('[trainer/live-sessions PATCH]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to update session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
