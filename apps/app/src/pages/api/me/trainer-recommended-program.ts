/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET — authenticated client: trainer-recommended active program id for HUD (if any).
 * Uses user-scoped Supabase (JWT) + RLS so this works without service role (PR #127).
 */

import type { APIRoute } from 'astro';
import { authenticateInvitationsApiRequest } from '@/lib/supabase/admin/auth';
import { fetchTrainerRecommendationForAuthenticatedSupabaseUser } from '@/lib/supabase/admin/trainer-client-enrollments';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const auth = await authenticateInvitationsApiRequest(request, cookies);
    if (!auth.ok) {
      return auth.response;
    }
    const { supabase, user } = auth;

    const { programId, trainerId } = await fetchTrainerRecommendationForAuthenticatedSupabaseUser(
      supabase,
      user.id
    );

    return new Response(JSON.stringify({ programId, trainerId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[me/trainer-recommended-program] Error:', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load recommendation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
