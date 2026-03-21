/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hub funnel analytics. Accepts events from Universal Activity Hub (no Supabase client).
 * Validates event names against FUNNEL_EVENTS and inserts into analytics_events.
 */

import type { APIRoute } from 'astro';
import { FUNNEL_EVENTS } from '@interval-timers/analytics';
import { checkRateLimit } from '@/lib/api-rate-limit';
import { corsPreflightResponse, getJsonResponseHeaders } from '@/lib/api-cors';
import { getSupabaseServer } from '@/lib/supabase/server';

const MAX_PROPERTIES_SIZE = 2048;

interface HubFunnelBody {
  event_name: string;
  session_id?: string;
  properties?: Record<string, unknown>;
  app_id?: string;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: getJsonResponseHeaders(),
  });
}

export const OPTIONS: APIRoute = () =>
  corsPreflightResponse() ?? new Response(null, { status: 204 });

export const POST: APIRoute = async ({ request }) => {
  const limit = checkRateLimit('hub-funnel', request);
  if (!limit.allowed) {
    const headers: Record<string, string> = { ...getJsonResponseHeaders() };
    if (limit.retryAfter) headers['Retry-After'] = String(limit.retryAfter);
    return new Response(JSON.stringify({ error: limit.error }), {
      status: 429,
      headers,
    });
  }

  try {
    let body: HubFunnelBody;
    try {
      body = (await request.json()) as HubFunnelBody;
    } catch {
      return jsonError('Invalid JSON', 400);
    }

    const eventName = typeof body.event_name === 'string' ? body.event_name : '';
    if (!eventName || !(FUNNEL_EVENTS as readonly string[]).includes(eventName)) {
      return jsonError('Invalid event_name', 400);
    }

    const sessionId = typeof body.session_id === 'string' ? body.session_id : null;
    let properties: Record<string, unknown> = {};
    if (body.properties && typeof body.properties === 'object') {
      properties = body.properties;
    }
    const propsStr = JSON.stringify(properties);
    if (propsStr.length > MAX_PROPERTIES_SIZE) {
      return jsonError('properties exceeds size limit', 400);
    }

    // Ignore client-provided app_id to avoid polluting analytics with arbitrary IDs
    const appId = 'universal_activity_hub';

    const supabase = getSupabaseServer();
    const { error } = await supabase.from('analytics_events').insert({
      event_name: eventName,
      user_id: null,
      session_id: sessionId,
      properties,
      app_id: appId,
    });

    if (error) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[api/analytics/hub-funnel] Insert error:', error);
      }
      return new Response(null, { status: 500 });
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[api/analytics/hub-funnel] Error:', err);
    }
    return new Response(null, { status: 500 });
  }
};
