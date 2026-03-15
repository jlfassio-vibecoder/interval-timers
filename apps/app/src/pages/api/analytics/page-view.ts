/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public API for recording page views (acquisition). No auth required.
 */

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '@/lib/supabase/server';

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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json().catch(() => ({}))) as PageViewBody;
    const path = typeof body.path === 'string' && body.path ? body.path : null;
    if (!path) {
      return new Response(null, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') ?? null;
    const ipCountry =
      request.headers.get('x-vercel-ip-country') ?? request.headers.get('cf-ipcountry') ?? null;

    const supabase = getSupabaseServer();
    const { error } = await supabase.from('web_events').insert({
      event_name: 'page_view',
      session_id: body.session_id ?? null,
      user_id: body.user_id ?? null,
      path,
      referrer: body.referrer ?? null,
      utm_source: body.utm_source ?? null,
      utm_medium: body.utm_medium ?? null,
      utm_campaign: body.utm_campaign ?? null,
      user_agent: userAgent,
      ip_country: ipCountry,
      occurred_at: new Date().toISOString(),
      properties: {},
      app_id: body.app_id ?? null,
    });

    if (error) {
      if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
        console.error('[api/analytics/page-view] Insert error:', error);
      }
      return new Response(null, { status: 500 });
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[api/analytics/page-view] Error:', err);
    }
    return new Response(null, { status: 500 });
  }
};
