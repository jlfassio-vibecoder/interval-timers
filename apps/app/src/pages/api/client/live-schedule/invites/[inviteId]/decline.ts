/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * POST decline a scheduled live session invite.
 */

import type { APIRoute } from 'astro';
import { authenticateInvitationsApiRequest } from '@/lib/supabase/admin/auth';

export const POST: APIRoute = async ({ request, cookies, params }) => {
  const inviteId = params.inviteId?.trim();
  if (!inviteId) {
    return new Response(JSON.stringify({ error: 'inviteId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const auth = await authenticateInvitationsApiRequest(request, cookies);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase.rpc('trainer_live_schedule_invite_decline', {
    p_invite_id: inviteId,
  });

  if (error) {
    if (import.meta.env.DEV) console.error('[live-schedule decline]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = data as { ok?: boolean; error?: string; status?: string } | null;
  if (!payload?.ok) {
    const msg = typeof payload?.error === 'string' ? payload.error : 'Decline failed';
    return new Response(JSON.stringify({ error: msg, ...payload }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, status: payload.status }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
