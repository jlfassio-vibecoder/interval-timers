/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET board + cards; PATCH card status — client + coach on program roster.
 */

import type { APIRoute } from 'astro';
import { authenticateInvitationsApiRequest } from '@/lib/supabase/admin/auth';
import {
  getWeeklyBoardForClient,
  isValidDateOnly,
  updateWeeklyActivityCardForClient,
} from '@/lib/supabase/admin/trainer-client-weekly-board';
import { isProgramClientOfTrainer } from '@/lib/supabase/admin/trainer-roster';

export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    const auth = await authenticateInvitationsApiRequest(request, cookies);
    if (!auth.ok) return auth.response;

    const trainerUserId = url.searchParams.get('trainerUserId')?.trim() ?? '';
    const weekStart = url.searchParams.get('weekStart')?.trim() ?? '';
    if (!trainerUserId) {
      return new Response(JSON.stringify({ error: 'trainerUserId query parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!isValidDateOnly(weekStart)) {
      return new Response(JSON.stringify({ error: 'weekStart query required (YYYY-MM-DD)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const clientUserId = auth.user.id;
    const inRoster = await isProgramClientOfTrainer(trainerUserId, clientUserId);
    if (!inRoster) {
      return new Response(JSON.stringify({ error: 'Coach not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await getWeeklyBoardForClient(clientUserId, trainerUserId, weekStart);
    if (!result.ok) {
      if (result.reason === 'not_in_program_roster') {
        return new Response(JSON.stringify({ error: 'Coach not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (result.reason === 'invalid_date') {
        return new Response(JSON.stringify({ error: 'weekStart query required (YYYY-MM-DD)' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify({
          error:
            'Could not load weekly activity. If migrations are not applied, run the P4 migration that creates client_weekly_activity_boards.',
          code: result.code,
          details: import.meta.env.DEV ? result.message : undefined,
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(result.payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[me/weekly-activity GET]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load weekly activity' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await authenticateInvitationsApiRequest(request, cookies);
    if (!auth.ok) return auth.response;

    let body: { trainerUserId?: string; cardId?: string; status?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const trainerUserId = typeof body.trainerUserId === 'string' ? body.trainerUserId.trim() : '';
    const cardId = typeof body.cardId === 'string' ? body.cardId.trim() : '';
    const status = body.status as 'planned' | 'done' | 'skipped' | undefined;

    if (!trainerUserId || !cardId || !status) {
      return new Response(JSON.stringify({ error: 'trainerUserId, cardId, and status required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const clientUserId = auth.user.id;
    const inRoster = await isProgramClientOfTrainer(trainerUserId, clientUserId);
    if (!inRoster) {
      return new Response(JSON.stringify({ error: 'Coach not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await updateWeeklyActivityCardForClient({
      clientUserId,
      cardId,
      status,
    });

    if (!result.ok) {
      const notFound = result.error === 'Card not found';
      const bad = result.error === 'Invalid status';
      return new Response(JSON.stringify({ error: result.error }), {
        status: notFound ? 404 : bad ? 400 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[me/weekly-activity PATCH]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to update card' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
