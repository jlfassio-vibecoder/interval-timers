/**
 * GET /api/invitations/preview?invite=<token>
 * Public inviter display for pending roster invites (no auth). For client (trainer) invites,
 * invitee email/phone may be included when the caller presents the same secret token as the link
 * (signup prefill). Friend-invitee contact is not returned from the preview payload.
 */

import type { APIRoute } from 'astro';
import {
  getRosterInvitePreview,
  looksLikeRosterInviteToken,
} from '@/lib/supabase/admin/roster-invitations';

export const GET: APIRoute = async ({ url }) => {
  try {
    const raw = url.searchParams.get('invite') ?? url.searchParams.get('token') ?? '';
    if (!looksLikeRosterInviteToken(raw)) {
      return new Response(JSON.stringify({ error: 'Invalid invitation' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const preview = await getRosterInvitePreview(raw);
    if (!preview) {
      return new Response(JSON.stringify({ error: 'Invitation not found or expired' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(preview), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[invitations/preview]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load invitation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
