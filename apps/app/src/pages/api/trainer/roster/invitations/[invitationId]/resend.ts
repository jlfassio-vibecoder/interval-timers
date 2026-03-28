/**
 * POST /api/trainer/roster/invitations/:invitationId/resend
 * Rotate token and extend expiry; optionally re-send invite email.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  resendRosterInvitation,
  resolvePublicAppUrlFromRequest,
} from '@/lib/supabase/admin/roster-invitations';
import { trySendRosterInviteEmail } from '@/lib/supabase/admin/roster-invite-delivery';

export const POST: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid } = await verifyRosterAccessRequest(request, cookies);
    const invitationId = params.invitationId?.trim();
    if (!invitationId) {
      return new Response(JSON.stringify({ error: 'Missing invitation id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const publicAppBaseHint = resolvePublicAppUrlFromRequest(request);
    const result = await resendRosterInvitation(uid, invitationId, publicAppBaseHint);

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'CONFLICT' ? 409 : 500;
      return new Response(JSON.stringify({ error: result.message, code: result.code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const emailDispatched = !!result.inviteeEmail?.trim();
    if (emailDispatched && result.inviteeEmail) {
      void trySendRosterInviteEmail(result.rawToken, result.inviteeEmail, result.inviteUrl);
    }

    return new Response(
      JSON.stringify({
        invitationId: result.invitationId,
        inviteUrl: result.inviteUrl,
        emailDispatched,
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
      console.error('[trainer/roster/invitations/resend]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to resend invitation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
