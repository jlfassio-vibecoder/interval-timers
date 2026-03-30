/**
 * GET /api/welcome/trainer-display — trainer first name, studio preview, and active enrollment count
 * for the authenticated client (service-role read; client cannot read trainer profile under RLS).
 */

import type { APIRoute } from 'astro';
import { authenticateInvitationsApiRequest } from '@/lib/supabase/admin/auth';
import { getWelcomeClientTrainerContext } from '@/lib/supabase/admin/welcome-trainer';
import { trainerFirstNameForWelcome } from '@/lib/welcome-landing-strings';

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await authenticateInvitationsApiRequest(request, cookies);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const programIdParam = url.searchParams.get('programId')?.trim() || null;

  try {
    const ctx = await getWelcomeClientTrainerContext(auth.user.id, {
      preferredProgramId: programIdParam,
    });
    const firstName = trainerFirstNameForWelcome(ctx.trainerDisplayName);
    return new Response(
      JSON.stringify({
        firstName: firstName ?? null,
        studio: ctx.studio,
        activeProgramCount: ctx.activeProgramCount,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[welcome/trainer-display]', error);
    }
    return new Response(JSON.stringify({ firstName: null, studio: null, activeProgramCount: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
