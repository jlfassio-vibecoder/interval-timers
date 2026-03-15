/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API for recording frontend errors. No auth required.
 */

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '@/lib/supabase/server';

const MESSAGE_MAX_LENGTH = 2000;
const STACK_MAX_LENGTH = 8000;

interface LogErrorBody {
  message?: string;
  stack?: string;
  page?: string;
  user_id?: string | null;
  session_id?: string | null;
  properties?: Record<string, unknown>;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as LogErrorBody;
    const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
    if (!rawMessage) {
      return new Response(null, { status: 400 });
    }
    const message = rawMessage.slice(0, MESSAGE_MAX_LENGTH);
    const stack = typeof body.stack === 'string' ? body.stack.slice(0, STACK_MAX_LENGTH) : null;
    const page = typeof body.page === 'string' ? body.page.slice(0, 500) : null;
    const userId = body.user_id != null && typeof body.user_id === 'string' ? body.user_id : null;
    const sessionId =
      body.session_id != null && typeof body.session_id === 'string'
        ? body.session_id.slice(0, 256)
        : null;
    const properties =
      body.properties != null &&
      typeof body.properties === 'object' &&
      !Array.isArray(body.properties)
        ? body.properties
        : {};

    const supabase = getSupabaseServer();
    const { error } = await supabase.from('errors_frontend').insert({
      message,
      stack,
      page,
      user_id: userId,
      session_id: sessionId,
      occurred_at: new Date().toISOString(),
      properties,
    });

    if (error) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[api/log-frontend-error] Insert error:', error);
      }
      return new Response(null, { status: 500 });
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[api/log-frontend-error] Error:', err);
    }
    return new Response(null, { status: 500 });
  }
};
