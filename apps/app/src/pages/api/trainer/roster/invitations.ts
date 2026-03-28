/**
 * GET /api/trainer/roster/invitations — pending invites created by the current user.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { listPendingInvitations } from '@/lib/supabase/admin/roster-invitations';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { uid } = await verifyRosterAccessRequest(request, cookies);
    const pending = await listPendingInvitations(uid);
    return new Response(JSON.stringify(pending), {
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
      console.error('[trainer/roster/invitations]', error);
    }
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
