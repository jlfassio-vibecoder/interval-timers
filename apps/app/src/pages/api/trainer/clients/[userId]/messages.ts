/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET/POST trainer–client messages (program roster only).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  createTrainerClientMessage,
  listTrainerClientMessages,
} from '@/lib/supabase/admin/trainer-client-messages';
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

    const inRoster = await isProgramClientOfTrainer(viewerId, clientUserId);
    if (!inRoster) {
      return new Response(JSON.stringify({ error: 'Client not found or not in your roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const cursor = url.searchParams.get('cursor') ?? undefined;
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;

    const result = await listTrainerClientMessages(viewerId, clientUserId, { cursor, limit });
    if (!result.ok) {
      // Align with roster 404; service-layer "Not allowed" should not surface as 500.
      if (result.error === 'Not allowed') {
        return new Response(JSON.stringify({ error: 'Client not found or not in your roster' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Mission Control access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/clients/.../messages GET]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load messages' }), {
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
      return new Response(JSON.stringify({ error: 'Client not found or not in your roster' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body: { body?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const text = typeof body.body === 'string' ? body.body : '';
    const result = await createTrainerClientMessage({
      trainerUserId: viewerId,
      clientUserId,
      authorUserId: viewerId,
      body: text,
    });

    if (!result.ok) {
      const badInput =
        result.error === 'Message body required' ||
        result.error.includes('at most') ||
        result.error === 'Invalid author';
      if (result.error === 'Not allowed') {
        return new Response(JSON.stringify({ error: 'Client not found or not in your roster' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Mission Control access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/clients/.../messages POST]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to send message' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
