/**
 * GET /api/welcome/trainer-display — first name (or best label) for the program trainer
 * for the authenticated client (service-role read; client cannot read trainer profile under RLS).
 */

import type { APIRoute } from 'astro';
import { authenticateInvitationsApiRequest } from '@/lib/supabase/admin/auth';
import { getTrainerDisplayForWelcomeClient } from '@/lib/supabase/admin/welcome-trainer';
import { trainerFirstNameForWelcome } from '@/lib/welcome-landing-strings';

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await authenticateInvitationsApiRequest(request, cookies);
  if (!auth.ok) return auth.response;

  try {
    const display = await getTrainerDisplayForWelcomeClient(auth.user.id);
    const firstName = trainerFirstNameForWelcome(display);
    return new Response(JSON.stringify({ firstName: firstName ?? null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[welcome/trainer-display]', error);
    }
    return new Response(JSON.stringify({ firstName: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
