/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET/POST — client reads/sends messages with a coach (program roster). Query/body: trainerUserId.
 */

import type { APIRoute } from 'astro';
import { authenticateInvitationsApiRequest } from '@/lib/supabase/admin/auth';
import {
  createTrainerClientMessage,
  listTrainerClientMessages,
} from '@/lib/supabase/admin/trainer-client-messages';
import { isProgramClientOfTrainer } from '@/lib/supabase/admin/trainer-roster';

export const GET: APIRoute = async ({ request, cookies, url }) => {
  try {
    const auth = await authenticateInvitationsApiRequest(request, cookies);
    if (!auth.ok) return auth.response;

    const trainerUserId = url.searchParams.get('trainerUserId')?.trim() ?? '';
    if (!trainerUserId) {
      return new Response(JSON.stringify({ error: 'trainerUserId query parameter required' }), {
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

    const cursor = url.searchParams.get('cursor') ?? undefined;
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

    const result = await listTrainerClientMessages(trainerUserId, clientUserId, { cursor, limit });
    if (!result.ok) {
      const status = result.error === 'Invalid cursor' ? 400 : 500;
      return new Response(JSON.stringify({ error: result.error }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        messages: result.messages,
        nextCursor: result.nextCursor,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[me/coach-messages GET]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load messages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await authenticateInvitationsApiRequest(request, cookies);
    if (!auth.ok) return auth.response;

    let body: { trainerUserId?: string; body?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const trainerUserId = typeof body.trainerUserId === 'string' ? body.trainerUserId.trim() : '';
    const text = typeof body.body === 'string' ? body.body : '';
    if (!trainerUserId) {
      return new Response(JSON.stringify({ error: 'trainerUserId required' }), {
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

    const result = await createTrainerClientMessage({
      trainerUserId,
      clientUserId,
      authorUserId: clientUserId,
      body: text,
    });

    if (!result.ok) {
      const badInput =
        result.error === 'Message body required' ||
        result.error.includes('at most') ||
        result.error === 'Invalid author';
      return new Response(JSON.stringify({ error: result.error }), {
        status: badInput ? 400 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: result.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[me/coach-messages POST]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to send message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
