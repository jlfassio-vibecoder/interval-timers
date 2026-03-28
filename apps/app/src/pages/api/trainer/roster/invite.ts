/**
 * POST /api/trainer/roster/invite
 * Create a friend (host) or client (trainer/admin) invitation; returns inviteUrl and optional email delivery.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  createRosterInvite,
  resolvePublicAppUrlFromRequest,
} from '@/lib/supabase/admin/roster-invitations';
import { trySendRosterInviteEmail } from '@/lib/supabase/admin/roster-invite-delivery';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { uid, role } = await verifyRosterAccessRequest(request, cookies);
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const channel = body.channel === 'phone' ? 'phone' : 'email';
    const email = typeof body.email === 'string' ? body.email : undefined;
    const phoneE164 = typeof body.phoneE164 === 'string' ? body.phoneE164 : undefined;
    const programIds = Array.isArray(body.programIds)
      ? (body.programIds as unknown[]).filter((x): x is string => typeof x === 'string')
      : [];

    const publicAppBaseHint = resolvePublicAppUrlFromRequest(request);

    const result = await createRosterInvite({
      inviterId: uid,
      inviterRole: role,
      channel,
      email,
      phoneE164,
      programIds,
      publicAppBaseHint,
    });

    if (!result.ok) {
      const status =
        result.code === 'CAP' || result.code === 'ALREADY_ROSTER'
          ? 409
          : result.code === 'VALIDATION'
            ? 400
            : 500;
      return new Response(JSON.stringify({ error: result.message, code: result.code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (channel === 'email' && email) {
      void trySendRosterInviteEmail(result.rawToken, email, result.inviteUrl);
    }

    const emailTrimmed = typeof email === 'string' ? email.trim() : '';
    return new Response(
      JSON.stringify({
        invitationId: result.invitationId,
        inviteUrl: result.inviteUrl,
        /** True when we invoke the Auth email path (best-effort; may no-op without service role). */
        emailDeliveryAttempted: channel === 'email' && emailTrimmed.length > 0,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
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
      console.error('[trainer/roster/invite]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to create invitation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
