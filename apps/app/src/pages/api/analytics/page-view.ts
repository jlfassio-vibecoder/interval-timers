/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API for recording page views (acquisition). No auth required.
 *
 * On merged domains (e.g. hiitworkouttimer.com), root `vercel.json` may rewrite `/api/*`
 * to the Mission Control deployment — set Supabase env on that project.
 */

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '@/lib/supabase/server';

/** Server-only route (must not be prerendered to static / missing on the edge). */
export const prerender = false;

interface PageViewBody {
  path?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  session_id?: string;
  user_id?: string | null;
  app_id?: string;
}

/** Postgres uuid — accept any 8-4-4-4-12 hex (Supabase auth ids are UUIDs; version nibble varies). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only pass through auth.users-shaped UUIDs; empty/invalid avoids PG uuid cast errors (22P02). */
function parseOptionalUserId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  return UUID_RE.test(t) ? t : null;
}

function capStr(value: unknown, max: number): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/** Browsers hitting the URL directly use GET — avoid a misleading 404. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ error: 'Method Not Allowed', allow: 'POST' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      Allow: 'POST',
    },
  });

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as PageViewBody;
    const path = typeof body.path === 'string' && body.path ? body.path : null;
    if (!path) {
      return new Response(null, { status: 400 });
    }
    // Cap path length to prevent abuse (e.g. huge payloads).
    const MAX_PATH_LENGTH = 2048;
    if (path.length > MAX_PATH_LENGTH) {
      return new Response(null, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') ?? null;
    const ipCountry =
      request.headers.get('x-vercel-ip-country') ?? request.headers.get('cf-ipcountry') ?? null;

    const userId = parseOptionalUserId(body.user_id);
    const sessionId = capStr(body.session_id, 512);
    const row = {
      event_name: 'page_view' as const,
      session_id: sessionId,
      user_id: userId,
      path,
      referrer: capStr(body.referrer, 2048),
      utm_source: capStr(body.utm_source, 256),
      utm_medium: capStr(body.utm_medium, 256),
      utm_campaign: capStr(body.utm_campaign, 256),
      user_agent: userAgent,
      ip_country: ipCountry,
      occurred_at: new Date().toISOString(),
      properties: {},
      app_id: capStr(body.app_id, 128),
    };

    const supabase = getSupabaseServer();
    let { error } = await supabase.from('web_events').insert(row);

    // Stale client or deleted auth user: FK on user_id → retry anonymous (session_id still set).
    if (error?.code === '23503' && row.user_id) {
      ({ error } = await supabase.from('web_events').insert({ ...row, user_id: null }));
    }

    if (error) {
      console.error('[api/analytics/page-view] Insert error:', {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      // Best-effort analytics: do not surface 500 to the client (pollutes DevTools; ops use Vercel logs).
      return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[api/analytics/page-view] Error:', err);
    return new Response(null, { status: 204 });
  }
};
