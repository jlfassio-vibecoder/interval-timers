/**
 * POST /api/invitations/accept — authenticated user accepts a roster invite (email/phone must match).
 */

import type { APIRoute } from 'astro';
import {
  acceptRosterInvite,
  looksLikeRosterInviteToken,
} from '@/lib/supabase/admin/roster-invitations';
import {
  authenticateInvitationsApiRequest,
  collectRosterInviteCandidateEmails,
} from '@/lib/supabase/admin/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await authenticateInvitationsApiRequest(request, cookies);
    if (!auth.ok) return auth.response;

    const { supabase, user } = auth;

    let body: { token?: string };
    try {
      body = (await request.json()) as { token?: string };
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const raw = typeof body.token === 'string' ? body.token : '';
    if (!looksLikeRosterInviteToken(raw)) {
      return new Response(JSON.stringify({ error: 'Invalid invitation token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const candidateEmails = await collectRosterInviteCandidateEmails(supabase, user);

    const result = await acceptRosterInvite(
      raw,
      user.id,
      candidateEmails,
      user.phone ?? undefined,
      supabase
    );

    if (!result.ok) {
      const status =
        result.code === 'MISMATCH'
          ? 403
          : result.code === 'EXPIRED' || result.code === 'NOT_FOUND'
            ? 410
            : result.code === 'CONFLICT'
              ? 409
              : 500;
      return new Response(JSON.stringify({ error: result.message, code: result.code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, kind: result.kind }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[invitations/accept]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to accept invitation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
