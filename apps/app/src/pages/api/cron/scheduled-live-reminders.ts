/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P2: POST/GET for Vercel Cron or external scheduler. Protect with SCHEDULED_LIVE_REMINDER_CRON_SECRET.
 */

import type { APIRoute } from 'astro';
import { runScheduledLiveReminders } from '@/lib/supabase/admin/live-schedule-reminders';

function authorize(request: Request): boolean {
  const secret =
    (import.meta.env.SCHEDULED_LIVE_REMINDER_CRON_SECRET as string | undefined)?.trim() ||
    (typeof process !== 'undefined' ? process.env.SCHEDULED_LIVE_REMINDER_CRON_SECRET?.trim() : '');
  if (!secret) {
    return import.meta.env.DEV;
  }
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  const hdr = request.headers.get('x-cron-secret');
  return hdr === secret;
}

export const POST: APIRoute = async ({ request }) => {
  if (!authorize(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const result = await runScheduledLiveReminders();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (import.meta.env.DEV) console.error('[cron/scheduled-live-reminders]', e);
    return new Response(JSON.stringify({ error: 'Failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = POST;
