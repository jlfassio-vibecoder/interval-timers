/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PATCH / DELETE weekly activity cards (trainer).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  deleteWeeklyActivityCard,
  updateWeeklyActivityCard,
} from '@/lib/supabase/admin/trainer-client-weekly-board';
import { isProgramClientOfTrainer } from '@/lib/supabase/admin/trainer-roster';

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return new Response(JSON.stringify({ error: 'Not available for host roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const clientUserId = params.userId;
    const cardId = params.cardId;
    if (!clientUserId || !cardId) {
      return new Response(JSON.stringify({ error: 'User ID and card ID required' }), {
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
      title?: string;
      scheduledDate?: string;
      activityType?: string;
      durationMinutes?: number | null;
      notes?: string | null;
      status?: 'planned' | 'done' | 'skipped';
      sortOrder?: number;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await updateWeeklyActivityCard({
      trainerUserId: viewerId,
      clientUserId,
      cardId,
      title: body.title,
      scheduledDate: body.scheduledDate,
      activityType: body.activityType,
      durationMinutes: body.durationMinutes,
      notes: body.notes,
      status: body.status,
      sortOrder: body.sortOrder,
    });

    if (!result.ok) {
      const notFound = result.error === 'Card not found';
      const bad =
        result.error === 'scheduledDate must fall in the board week' ||
        result.error === 'Title required' ||
        result.error === 'Title too long' ||
        result.error === 'Invalid status';
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
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Mission Control access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[weekly-board/cards PATCH]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to update card' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return new Response(JSON.stringify({ error: 'Not available for host roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const clientUserId = params.userId;
    const cardId = params.cardId;
    if (!clientUserId || !cardId) {
      return new Response(JSON.stringify({ error: 'User ID and card ID required' }), {
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

    const result = await deleteWeeklyActivityCard(viewerId, clientUserId, cardId);
    if (!result.ok) {
      const notFound = result.error === 'Card not found';
      return new Response(JSON.stringify({ error: result.error }), {
        status: notFound ? 404 : 500,
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
      console.error('[weekly-board/cards DELETE]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to delete card' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
