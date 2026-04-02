/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * GET — authenticated client: trainer-recommended active program id for HUD (if any).
 */

import type { APIRoute } from 'astro';
import { getCurrentUserFromRequest } from '@/lib/supabase/admin/auth';
import {
  getTrainerRecommendedActiveProgramForClient,
  resolvePrimaryTrainerIdForClient,
} from '@/lib/supabase/admin/trainer-client-enrollments';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const user = await getCurrentUserFromRequest(request, cookies);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const trainerId = await resolvePrimaryTrainerIdForClient(user.uid);
    if (!trainerId) {
      return new Response(JSON.stringify({ programId: null, trainerId: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const programId = await getTrainerRecommendedActiveProgramForClient(user.uid, trainerId);
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
