/**
 * POST /api/invitations/accept-pending
 * Complete roster invites for the signed-in user when the invite token was lost after auth redirects.
 */

import type { APIRoute } from 'astro';
import { acceptPendingRosterInvitesForSession } from '@/lib/supabase/admin/roster-invitations';
import {
  authenticateInvitationsApiRequest,
  collectRosterInviteCandidateEmails,
} from '@/lib/supabase/admin/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await authenticateInvitationsApiRequest(request, cookies);
    if (!auth.ok) return auth.response;

    const { supabase, user } = auth;
    const candidateEmails = await collectRosterInviteCandidateEmails(supabase, user);

    const { acceptedCount } = await acceptPendingRosterInvitesForSession(
      user.id,
      candidateEmails,
      user.phone ?? undefined
    );

    return new Response(JSON.stringify({ ok: true, acceptedCount }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[invitations/accept-pending]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to accept invitations' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
