/**
 * GET — single trainer workout series (sessions + unparsed snapshot).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { fetchTrainerWorkoutSeriesOwned } from '@/lib/supabase/admin/trainer-workout-series';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, cookies, params }) => {
  try {
    const { uid, role } = await verifyRosterAccessRequest(request, cookies);
    if (role === 'host') {
      return json({ error: 'Not available for host role' }, 404);
    }

    const seriesId = params.seriesId;
    if (!seriesId) return json({ error: 'Series ID required' }, 400);

    const detail = await fetchTrainerWorkoutSeriesOwned(uid, seriesId);
    if (!detail) return json({ error: 'Series not found' }, 404);

    return json({
      id: detail.id,
      title: detail.title,
      description: detail.description,
      rawWorkoutSet: detail.rawWorkoutSet,
      aiChainMetadata: detail.aiChainMetadata,
      createdAt: detail.createdAt,
      sessions: detail.sessions,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return json({ error: 'Unauthorized. Mission Control access required.' }, 401);
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/workout-series GET]', error);
    }
    return json({ error: 'Failed to load series' }, 500);
  }
};
