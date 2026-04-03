/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET weekly board + cards; POST create card (program roster gate, same as messages).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  createWeeklyActivityCard,
  getWeeklyBoardForTrainer,
} from '@/lib/supabase/admin/trainer-client-weekly-board';
import { isLocalMondayDateOnly } from '@/lib/performance-lab/weekly-board-dates';
import { isProgramClientOfTrainer } from '@/lib/supabase/admin/trainer-roster';

export const GET: APIRoute = async ({ request, cookies, params, url }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return new Response(JSON.stringify({ error: 'Not available for host roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const clientUserId = params.userId;
    if (!clientUserId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const weekStart = url.searchParams.get('weekStart')?.trim() ?? '';
    if (!isLocalMondayDateOnly(weekStart)) {
      return new Response(JSON.stringify({ error: 'weekStart query required (YYYY-MM-DD, Monday of week)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const inRoster = await isProgramClientOfTrainer(viewerId, clientUserId);
    if (!inRoster) {
      return new Response(JSON.stringify({ error: 'Client not found or not in your program roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await getWeeklyBoardForTrainer(viewerId, clientUserId, weekStart);
    if (!result.ok) {
      if (result.reason === 'not_in_program_roster') {
        return new Response(JSON.stringify({ error: 'Client not found or not in your program roster' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (result.reason === 'invalid_date') {
        return new Response(
          JSON.stringify({ error: 'weekStart query required (YYYY-MM-DD, Monday of week)' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          error:
            'Could not load weekly board. If migrations are not applied, run the P4 migration that creates client_weekly_activity_boards.',
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
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Mission Control access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/clients/.../weekly-board GET]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load weekly board' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return new Response(JSON.stringify({ error: 'Not available for host roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const clientUserId = params.userId;
    if (!clientUserId) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const inRoster = await isProgramClientOfTrainer(viewerId, clientUserId);
    if (!inRoster) {
      return new Response(JSON.stringify({ error: 'Client not found or not in your program roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: {
      weekStartDate?: string;
      scheduledDate?: string;
      title?: string;
      activityType?: string;
      durationMinutes?: number | null;
      notes?: string | null;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const weekStartDate = typeof body.weekStartDate === 'string' ? body.weekStartDate.trim() : '';
    const scheduledDate = typeof body.scheduledDate === 'string' ? body.scheduledDate.trim() : '';
    const title = typeof body.title === 'string' ? body.title : '';

    const result = await createWeeklyActivityCard({
      trainerUserId: viewerId,
      clientUserId,
      weekStartDate,
      scheduledDate,
      title,
      activityType: body.activityType,
      durationMinutes: body.durationMinutes,
      notes: body.notes,
    });

    if (!result.ok) {
      const bad =
        result.error === 'Invalid date' ||
        result.error === 'weekStartDate must be a Monday (YYYY-MM-DD)' ||
        result.error === 'scheduledDate must fall in the board week' ||
        result.error === 'Title required' ||
        result.error === 'Title too long';
      return new Response(JSON.stringify({ error: result.error }), {
        status: bad ? 400 : 500,
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
      console.error('[trainer/clients/.../weekly-board POST]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to create card' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
