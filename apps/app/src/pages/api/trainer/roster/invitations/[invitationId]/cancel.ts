/**
 * POST /api/trainer/roster/invitations/:invitationId/cancel
 * Revoke a pending invitation.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { revokeRosterInvitation } from '@/lib/supabase/admin/roster-invitations';

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

    const result = await revokeRosterInvitation(uid, invitationId);

    if (!result.ok) {
      const status =
        result.code === 'NOT_FOUND' ? 404 : result.code === 'CONFLICT' ? 409 : 500;
      return new Response(JSON.stringify({ error: result.message, code: result.code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
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
      console.error('[trainer/roster/invitations/cancel]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to cancel invitation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
